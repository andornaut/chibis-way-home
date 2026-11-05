import { type AgentSample, type AgentTick, centre, type TraceAttack } from "./agentTrace";

// Checks over a structured agent trace. Thresholds and selections arrive as parameters, so the
// same checks serve any game's data.

interface Violation {
  readonly agent: string;
  readonly detail: string;
  readonly tick: number;
}

export interface Property<Tick> {
  readonly check: (ticks: readonly Tick[]) => readonly Violation[];
  readonly id: string;
  // The rule the property enforces, as its source names it.
  readonly rule: string;
}

interface PropertyResult {
  readonly id: string;
  readonly violations: readonly Violation[];
}

export function checkProperties<Tick>(
  properties: readonly Property<Tick>[],
  ticks: readonly Tick[],
): PropertyResult[] {
  return properties.map(({ check, id }) => ({ id, violations: check(ticks) }));
}

// Absorbs float error in tick-time sums.
const EPSILON = 1e-6;

interface Step<World> {
  readonly agent: AgentSample;
  readonly tick: AgentTick<World>;
}

// Each agent's samples split into runs that never cross an episode boundary.
function agentRuns<World>(ticks: readonly AgentTick<World>[]): Step<World>[][] {
  const runs = new Map<string, Step<World>[]>();
  const all: Step<World>[][] = [];
  let episode: number | undefined;
  for (const tick of ticks) {
    if (tick.episode !== episode) {
      runs.clear();
      episode = tick.episode;
    }
    for (const agent of tick.agents) {
      let run = runs.get(agent.id);
      if (!run) {
        run = [];
        runs.set(agent.id, run);
        all.push(run);
      }
      run.push({ agent, tick });
    }
  }
  return all;
}

const sameAttack = (a: TraceAttack | undefined, b: TraceAttack | undefined) =>
  a !== undefined && b !== undefined && a.id === b.id && a.phase === b.phase;

// A tell of a new attack, or of another attack than the previous tick's, begins this tick.
export const tellStarts = (previous: AgentSample | undefined, current: AgentSample) =>
  current.attack?.phase === "tell" && !sameAttack(previous?.attack, current.attack);

function eachPair<World>(
  ticks: readonly AgentTick<World>[],
  visit: (previous: Step<World>, current: Step<World>, index: number, run: Step<World>[]) => void,
): void {
  for (const run of agentRuns(ticks)) {
    for (let index = 1; index < run.length; index++) {
      visit(run[index - 1]!, run[index]!, index, run);
    }
  }
}

const violation = (step: Step<unknown>, detail: string): Violation => ({
  agent: step.agent.id,
  detail,
  tick: step.tick.tick,
});

// Tick-sampled phases start and end inside their ticks: a run of n ticks lasted more than n - 1
// and less than n + 1 steps.

// A committed action follows a contiguous tell of its own attack lasting at least the minimum.
export function tellPrecedesCommit<World>(
  rule: string,
  stepSeconds: number,
  minimumSeconds: (agent: AgentSample, attack: string, continues: boolean) => number,
): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      for (const run of agentRuns(ticks)) {
        let tellStart: number | undefined;
        run.forEach((step, index) => {
          const previous = run[index - 1]?.agent;
          const { attack } = step.agent;
          if (tellStarts(previous, step.agent)) {
            tellStart = index;
          }
          if (attack?.phase !== "committed" || sameAttack(previous?.attack, attack)) {
            return;
          }
          if (
            index === 0 ||
            previous?.attack?.id !== attack.id ||
            previous.attack.phase !== "tell" ||
            tellStart === undefined
          ) {
            if (index > 0) {
              found.push(violation(step, `${attack.id} committed without its tell`));
            }
            return;
          }
          const longest = (index - tellStart + 1) * stepSeconds;
          const minimum = minimumSeconds(step.agent, attack.id, previous.attack.continues === true);
          if (longest + EPSILON < minimum) {
            found.push(
              violation(step, `${attack.id} tell at most ${longest.toFixed(3)} s < ${minimum} s`),
            );
          }
        });
      }
      return found;
    },
    id: "tell-precedes-commit",
    rule,
  };
}

// No tell lasts longer than the maximum, whether it commits or is cancelled.
export function tellBounded<World>(
  rule: string,
  stepSeconds: number,
  maximumSeconds: (agent: AgentSample, attack: string) => number,
): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      for (const run of agentRuns(ticks)) {
        let start: number | undefined;
        run.forEach((step, index) => {
          const previous = run[index - 1]?.agent;
          if (tellStarts(previous, step.agent)) {
            start = index;
          }
          const tell = previous?.attack?.phase === "tell" ? previous.attack : undefined;
          const ends = tell !== undefined && !sameAttack(tell, step.agent.attack);
          if (ends && start !== undefined) {
            const shortest = (index - start - 1) * stepSeconds;
            const maximum = maximumSeconds(step.agent, tell.id);
            if (shortest > maximum + EPSILON) {
              found.push(
                violation(step, `${tell.id} tell at least ${shortest.toFixed(3)} s > ${maximum} s`),
              );
            }
          }
          if (step.agent.attack?.phase !== "tell") {
            start = undefined;
          }
        });
      }
      return found;
    },
    id: "tell-bounded",
    rule,
  };
}

// While an attack is committed no other attack starts, and it ends only at its completion. Its
// own continuing tell stays inside it.
export function singleCommittedAttack<World>(rule: string): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      eachPair(ticks, (previous, current) => {
        const held = previous.agent.attack;
        const next = current.agent.attack;
        const retell = next?.continues === true && next.id === held?.id;
        if (held?.phase === "committed" && next && !sameAttack(held, next) && !retell) {
          found.push(violation(current, `${next.id} ${next.phase} during committed ${held.id}`));
        }
      });
      return found;
    },
    id: "single-committed-attack",
    rule,
  };
}

// Completing a committed attack starts the cooldown, and no tell starts before it elapses.
export function cooldownHonoured<World>(
  rule: string,
  stepSeconds: number,
  cooldownSeconds: (agent: AgentSample) => number,
): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      for (const run of agentRuns(ticks)) {
        let completed: number | undefined;
        run.forEach((step, index) => {
          const previous = run[index - 1]?.agent;
          const cooldown = cooldownSeconds(step.agent);
          if (
            (previous?.attack?.phase === "committed" || previous?.attack?.continues) &&
            !step.agent.attack
          ) {
            completed = index;
            if ((step.agent.cooldownSeconds ?? 0) + stepSeconds + EPSILON < cooldown) {
              found.push(
                violation(step, `${previous.attack.id} completed without starting its cooldown`),
              );
            }
          }
          if (completed !== undefined && tellStarts(previous, step.agent)) {
            const longest = (index - completed + 1) * stepSeconds;
            if (longest + EPSILON < cooldown) {
              found.push(
                violation(
                  step,
                  `${step.agent.attack!.id} tell ${longest.toFixed(3)} s after completion`,
                ),
              );
            }
            completed = undefined;
          }
        });
      }
      return found;
    },
    id: "cooldown-honoured",
    rule,
  };
}

// A tell cancelled before commitment does not restart the cooldown. A continuing tell is inside
// its committed attack, so it never cancels.
export function cancelledTellKeepsCooldown<World>(rule: string): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      for (const run of agentRuns(ticks)) {
        let before: number | undefined;
        run.forEach((step, index) => {
          const previous = run[index - 1]?.agent;
          if (tellStarts(previous, step.agent)) {
            before = previous?.cooldownSeconds ?? 0;
          }
          if (
            previous?.attack?.phase === "tell" &&
            !previous.attack.continues &&
            !step.agent.attack &&
            before !== undefined
          ) {
            const after = step.agent.cooldownSeconds ?? 0;
            if (after > before + EPSILON) {
              found.push(
                violation(step, `cancelled ${previous.attack.id} raised cooldown to ${after}`),
              );
            }
          }
        });
      }
      return found;
    },
    id: "cancelled-tell-keeps-cooldown",
    rule,
  };
}

// A tell ends in its own committed attack, its own continued tell or a cancel, never in another
// attack's action: there are no feints. A cancel and a new tell can share a tick.
export function tellResolves<World>(rule: string): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      eachPair(ticks, (previous, current) => {
        const tell = previous.agent.attack;
        const next = current.agent.attack;
        if (
          tell?.phase === "tell" &&
          next &&
          next.id !== tell.id &&
          (next.phase === "committed" || next.continues)
        ) {
          found.push(violation(current, `${tell.id} tell became ${next.id} ${next.phase}`));
        }
      });
      return found;
    },
    id: "tell-resolves",
    rule,
  };
}

// After `cancels` consecutive cancelled tells, no tell starts for `seconds`. A cancel is a tell
// that ends, without a new cooldown, in no attack or in another attack's tell. A commit or an
// escape resets the count, and so does the pause.
export function tellCancelPause<World>(
  rule: string,
  stepSeconds: number,
  pause: (agent: AgentSample) => { readonly cancels: number; readonly seconds: number } | undefined,
): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      for (const run of agentRuns(ticks)) {
        let cancels = 0;
        let paused: number | undefined;
        run.forEach((step, index) => {
          const limits = pause(step.agent);
          const previous = run[index - 1]?.agent;
          const { agent } = step;
          if (!limits) {
            return;
          }
          // The longest the pause can have run by the end of this tick.
          const longest = (from: number) => (index - from + 1) * stepSeconds;
          if (paused !== undefined && longest(paused) >= limits.seconds - EPSILON) {
            paused = undefined;
          }
          if (agent.pursuit === "escaped") {
            cancels = 0;
            paused = undefined;
            return;
          }
          if (agent.attack?.phase === "committed") {
            cancels = 0;
          }
          const tell = previous?.attack?.phase === "tell" ? previous.attack : undefined;
          const cancelled =
            tell !== undefined &&
            !tell.continues &&
            (!agent.attack || (agent.attack.phase === "tell" && agent.attack.id !== tell.id)) &&
            (agent.cooldownSeconds ?? 0) <= (previous!.cooldownSeconds ?? 0) + EPSILON;
          if (cancelled && ++cancels >= limits.cancels) {
            cancels = 0;
            paused = index;
          }
          if (tellStarts(previous, agent) && !agent.attack!.continues && paused !== undefined) {
            found.push(
              violation(
                step,
                `${agent.attack!.id} tell at most ${longest(paused).toFixed(3)} s into the pause`,
              ),
            );
            paused = undefined;
          }
        });
      }
      return found;
    },
    id: "tell-cancel-pause",
    rule,
  };
}

// An engaged agent eligible to move travels at least minimum horizontally within each window.
export function noStall<World>(
  rule: string,
  stepSeconds: number,
  windowSeconds: number,
  minimum: (agent: AgentSample) => number,
  eligible: (tick: AgentTick<World>, agent: AgentSample) => boolean,
): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      for (const run of agentRuns(ticks)) {
        let anchor: number | undefined;
        let reported = false;
        run.forEach((step, index) => {
          if (!eligible(step.tick, step.agent)) {
            anchor = undefined;
            return;
          }
          if (
            anchor === undefined ||
            Math.abs(step.agent.at.x - run[anchor]!.agent.at.x) >= minimum(step.agent)
          ) {
            anchor = index;
            reported = false;
            return;
          }
          if (!reported && (index - anchor) * stepSeconds >= windowSeconds - EPSILON) {
            reported = true;
            found.push(
              violation(
                run[anchor]!,
                `stalled from tick ${run[anchor]!.tick.tick} for ${windowSeconds} s ` +
                  `at x ${run[anchor]!.agent.at.x.toFixed(1)}, ${step.agent.state}`,
              ),
            );
          }
        });
      }
      return found;
    },
    id: "no-stall",
    rule,
  };
}

// Counting only eligible time, a tell of a counted attack starts within each window. Eligible
// time pauses, and does not reset, while no counted attack may start.
export function attackCadence<World>(
  id: string,
  rule: string,
  stepSeconds: number,
  windowSeconds: number,
  counts: (agent: AgentSample, attack: string) => boolean,
  eligible: (tick: AgentTick<World>, agent: AgentSample) => boolean,
): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      for (const run of agentRuns(ticks)) {
        let waited = 0;
        let reported = false;
        run.forEach((step, index) => {
          const previous = run[index - 1]?.agent;
          if (tellStarts(previous, step.agent) && counts(step.agent, step.agent.attack!.id)) {
            waited = 0;
            reported = false;
            return;
          }
          if (!eligible(step.tick, step.agent)) {
            return;
          }
          waited += stepSeconds;
          if (!reported && waited > windowSeconds + EPSILON) {
            reported = true;
            found.push(violation(step, `no counted tell in ${windowSeconds} s of eligible time`));
          }
        });
      }
      return found;
    },
    id,
    rule,
  };
}

// Pursuit ends exactly when the centre distance at the start of a step exceeds the escape distance.
export function escapeAtDistance<World>(
  rule: string,
  escapeDistance: (agent: AgentSample) => number | undefined,
): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      eachPair(ticks, (previous, current) => {
        const limit = escapeDistance(current.agent);
        if (limit === undefined || previous.agent.pursuit !== "engaged") {
          return;
        }
        const from = centre(previous.agent);
        const to = centre(previous.tick.target);
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const escaped = current.agent.pursuit === "escaped";
        if (distance > limit + EPSILON && !escaped) {
          found.push(violation(current, `still engaged at ${distance.toFixed(1)} > ${limit}`));
        }
        if (escaped && distance <= limit - EPSILON) {
          found.push(violation(current, `escaped at ${distance.toFixed(1)} <= ${limit}`));
        }
      });
      return found;
    },
    id: "escape-at-distance",
    rule,
  };
}

// An escaped agent starts no new attack. A tell in the tick that rearms it is engaged.
export function noAttackWhileEscaped<World>(rule: string): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      eachPair(ticks, (previous, current) => {
        if (current.agent.pursuit === "escaped" && tellStarts(previous.agent, current.agent)) {
          found.push(violation(current, `${current.agent.attack!.id} tell while escaped`));
        }
      });
      return found;
    },
    id: "no-attack-while-escaped",
    rule,
  };
}

// No step moves an agent farther than its maximum, so it never teleports.
export function boundedStep<World>(
  rule: string,
  maximum: (agent: AgentSample) => number,
): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      eachPair(ticks, (previous, current) => {
        const moved = Math.hypot(
          current.agent.at.x - previous.agent.at.x,
          current.agent.at.y - previous.agent.at.y,
        );
        if (moved > maximum(current.agent) + EPSILON) {
          found.push(violation(current, `moved ${moved.toFixed(1)} in one step`));
        }
      });
      return found;
    },
    id: "bounded-step",
    rule,
  };
}

// Within one stay in a state with a travel limit, the agent moves horizontally only along the
// heading of the stay's first sample and at most the limit from it. Reported once per stay.
export function travelBounded<World>(
  rule: string,
  limit: (agent: AgentSample) => number | undefined,
): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      for (const run of agentRuns(ticks)) {
        let first: AgentSample | undefined;
        let reported = false;
        for (const step of run) {
          const { agent } = step;
          if (!first || agent.state !== first.state) {
            first = agent;
            reported = false;
          }
          const maximum = limit(agent);
          if (maximum === undefined || reported) {
            continue;
          }
          const travelled = (agent.at.x - first.at.x) * first.facing;
          if (travelled < -EPSILON || travelled > maximum + EPSILON) {
            found.push(violation(step, `${agent.state} travelled ${travelled.toFixed(1)}`));
            reported = true;
          }
        }
      }
      return found;
    },
    id: "travel-bounded",
    rule,
  };
}

// A per-tick predicate over one agent, reported once per contiguous failing run.
export function everyTick<World>(
  id: string,
  rule: string,
  holds: (
    tick: AgentTick<World>,
    agent: AgentSample,
    previous: AgentSample | undefined,
  ) => string | undefined,
): Property<AgentTick<World>> {
  return {
    check: (ticks) => {
      const found: Violation[] = [];
      for (const run of agentRuns(ticks)) {
        let failing = false;
        run.forEach((step, index) => {
          const detail = holds(step.tick, step.agent, run[index - 1]?.agent);
          if (detail !== undefined && !failing) {
            found.push(violation(step, detail));
          }
          failing = detail !== undefined;
        });
      }
      return found;
    },
    id,
    rule,
  };
}
