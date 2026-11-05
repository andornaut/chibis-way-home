import { insetRect, rectsOverlap } from "@andornaut/game-kit/rect";

import {
  attackCadence,
  boundedStep,
  cancelledTellKeepsCooldown,
  cooldownHonoured,
  escapeAtDistance,
  everyTick,
  noAttackWhileEscaped,
  noStall,
  type Property,
  singleCommittedAttack,
  stillness,
  tellBounded,
  tellCancelPause,
  tellPrecedesCommit,
  tellResolves,
  tellStarts,
  travelBounded,
} from "../ai/agentProperties";
import type { AgentSample } from "../ai/agentTrace";
import { EDGE, STEP_SECONDS } from "../core";
import { TILE } from "../data/screen";
import type { BehaviourPlan, Rect, ZoneLayout } from "../data/types";
import { contactBox } from "../rules/behaviourTrack";
import { BOSSES, type BossTick } from "./bossSimulator";

// Boss rules from gameplay/design.md as checks over a boss trace. Thresholds are read from the
// zone's resolved behaviour data, or are the design's own bounds where data has none.

const DESIGN = "gameplay/design.md";
const RULES = {
  attackCadence: `${DESIGN} Objects: Animals`,
  attackSequencing: `${DESIGN} Objects: Attack sequencing`,
  attackTells: `${DESIGN} Objects: Attack tells`,
  bossDeath: `${DESIGN} Objects: Boss death`,
  deferral: `${DESIGN} Forced transit: Deferral`,
  enemyPursuit: `${DESIGN} Objects: Enemy pursuit`,
  flight: `${DESIGN} Boss encounter principles: Flight`,
  idleRecovery: `${DESIGN} Objects: Idle recovery`,
  pebbleCycle: `${DESIGN} Pebble encounter: Cycle`,
  recovery: `${DESIGN} Boss encounter principles: Recovery`,
  traversal: `${DESIGN} Boss encounter principles: Traversal and variety`,
  trixiRush: `${DESIGN} Trixi encounter: Rush`,
} as const;

// Each boss character's resolved plan in the layout.
function bossPlans(layout: ZoneLayout): ReadonlyMap<string, BehaviourPlan> {
  const plans = new Map<string, BehaviourPlan>();
  for (const area of Object.values(layout.areas)) {
    for (const object of area.objects) {
      if (object.character in BOSSES && object.behaviour) {
        plans.set(object.character, object.behaviour);
      }
    }
  }
  return plans;
}

const attackStates = (plan: BehaviourPlan, id: string, phase: "committed" | "tell") =>
  Object.entries(plan.states).filter(
    ([, node]) => node.attack?.id === id && node.attack.phase === phase,
  );

const elapsedSeconds = (plan: BehaviourPlan, from: string, to: (key: string) => boolean) =>
  plan.states[from]!.transitions.flatMap(({ to: key, when }) =>
    to(key)
      ? when.flatMap((condition) => (condition.kind === "elapsed" ? [condition.seconds] : []))
      : [],
  );

// The shortest authored tell, or continuing tell, before an attack's committed state.
export function minimumTellSeconds(plan: BehaviourPlan, id: string, continues = false): number {
  const committed = new Set(attackStates(plan, id, "committed").map(([key]) => key));
  const seconds = attackStates(plan, id, "tell")
    .filter(([, node]) => (node.attack!.continues === true) === continues)
    .flatMap(([key]) => elapsedSeconds(plan, key, (to) => committed.has(to)));
  if (seconds.length === 0) {
    throw new Error(`No authored ${continues ? "continuing " : ""}tell before ${id}`);
  }
  return Math.min(...seconds);
}

// The longest authored tell deadline of an attack, committed or cancelled.
export function maximumTellSeconds(plan: BehaviourPlan, id: string): number {
  const tells = new Set(attackStates(plan, id, "tell").map(([key]) => key));
  const seconds = [...tells].flatMap((key) => elapsedSeconds(plan, key, (to) => !tells.has(to)));
  if (seconds.length === 0) {
    throw new Error(`No authored tell deadline for ${id}`);
  }
  return Math.max(...seconds);
}

// Idle recovery: while engaged and more than two tiles from Chibi, a boss moves half a tile
// horizontally (the watchdog's minimum movement) within every four seconds.
const STALL_BOUND = { distance: 2 * TILE, seconds: 4 } as const;

// Allowed stillness for an engaged ground boss more than two tiles from Chibi: tells and other
// attack phases, takeoff preparation (0.6 s, at most once per 2 s) and post-attack rest (0.4 s).
// Anything else stands still at most the grace, which absorbs one-tick turns and leg handoffs.
const STILLNESS = {
  graceSeconds: 3 * STEP_SECONDS,
  preparation: { everySeconds: 2, kind: "takeoff-preparation", maxSeconds: 0.6 },
  recovery: { kind: "post-attack-recovery", maxSeconds: 0.4 },
} as const;

// Objects: each boss starts a charge or special tell within 10 s of eligible engaged time, and
// its distinct special tell within 20 s.
const CADENCE_SECONDS = { any: 10, special: 20 } as const;

// Each boss's charge or contact dive; its other attacks are its specials.
export const CHARGE_ATTACKS: Readonly<Record<string, string>> = {
  "bear-antagonist": "charge",
  "dog-antagonist": "charge",
  "ferret-antagonist": "charge",
  "goose-antagonist": "charge",
  "pigeon-antagonist": "swoop",
  "raccoon-antagonist": "charge",
};

// The attacks forced-transit deferral holds back: Pebble's targeted swoop and aimed poop burst.
export const DEFERRED_ATTACKS: Readonly<Record<string, readonly string[]>> = {
  "pigeon-antagonist": ["drop-burst", "swoop"],
};

// Attacks whose tell is entered only while the targeted-attack window allows it.
export function targetedAttacks(plan: BehaviourPlan): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const node of Object.values(plan.states)) {
    for (const { to, when } of node.transitions) {
      const target = plan.states[to]?.attack;
      if (target?.phase === "tell" && when.some(({ kind }) => kind === "targeted-attack-allowed")) {
        ids.add(target.id);
      }
    }
  }
  return ids;
}

// The fastest authored travel: state speeds, ground traversal launch and fall, and hop rise.
function fastestSpeed(plan: BehaviourPlan): number {
  return Math.max(
    ...Object.values(plan.states).flatMap(({ motion }) => [
      motion.kind === "wait" ? 0 : motion.speed,
      ...(motion.kind === "pursue" && motion.mode === "ground" && motion.traversal
        ? [motion.traversal.jumpSpeed, motion.traversal.maxFallSpeed, motion.traversal.speed]
        : []),
      ...(motion.kind === "hop" ? [(4 * motion.hopHeight) / motion.hopSeconds] : []),
    ]),
  );
}

const flies = (plan: BehaviourPlan) =>
  Object.values(plan.states).some(
    ({ motion }) => motion.kind === "fly" || (motion.kind === "pursue" && motion.mode === "fly"),
  );

// Each tell id a plan can start.
export function tellAttacks(plan: BehaviourPlan): ReadonlySet<string> {
  return new Set(
    Object.values(plan.states).flatMap(({ attack }) =>
      attack?.phase === "tell" ? [attack.id] : [],
    ),
  );
}

// Within seconds of the start, each boss's feet rise to the support top at y (pixels): pursuit
// follows the map up to the surface Chibi stands on. A scenario-specific check.
export function risesToRow(y: number, seconds: number): Property<BossTick> {
  return {
    check: (ticks) => {
      const deadline = Math.round(seconds / STEP_SECONDS);
      const ids = new Set(ticks.flatMap(({ agents }) => agents.map(({ id }) => id)));
      return [...ids].flatMap((id) =>
        ticks.some(
          ({ agents, tick }) =>
            tick <= deadline &&
            agents.some((agent) => agent.id === id && agent.at.y + agent.height <= y + EDGE),
        )
          ? []
          : [{ agent: id, detail: `feet not up to y ${y} within ${seconds} s`, tick: deadline }],
      );
    },
    id: "rises-to-row",
    rule: RULES.enemyPursuit,
  };
}

// While engaged more than two tiles from Chibi and outside attack phases, each boss moves the
// watchdog's minimum horizontally within every window: it routes or paces, never hops in place.
export function movesWhileEngaged(windowSeconds: number, minimum: number): Property<BossTick> {
  return {
    ...noStall(
      RULES.enemyPursuit,
      STEP_SECONDS,
      windowSeconds,
      () => minimum,
      ({ target }, agent) => {
        const gap = Math.max(
          target.at.x - (agent.at.x + agent.width),
          agent.at.x - (target.at.x + target.width),
        );
        return (
          agent.pursuit === "engaged" && agent.attack === undefined && gap > STALL_BOUND.distance
        );
      },
    ),
    id: "moves-while-engaged",
  };
}

// Rearming after escape: from the tick Chibi settles past cover, each boss present then crosses
// edge (a pixel x on the cover between them) with its body centre on his side within seconds.
// Without a settling tick, he settles where he stands still on the ground for the rest of the
// run. A scenario-specific check: the edge names cover the boss can clear.
export function crossesAfterSettle(
  edge: number,
  seconds: number,
  settledTick?: number,
): Property<BossTick> {
  return {
    check: (ticks) => {
      const last = ticks.at(-1);
      if (!last) {
        return [];
      }
      const still = (tick: BossTick) =>
        tick.episode === last.episode &&
        tick.target.grounded &&
        tick.target.at.x === last.target.at.x &&
        tick.target.at.y === last.target.at.y;
      let settled = ticks.findIndex(({ tick }) => tick === settledTick);
      if (settled < 0) {
        settled = ticks.length - 1;
        while (settled > 0 && still(ticks[settled - 1]!)) {
          settled--;
        }
      }
      const from = ticks[settled]!;
      const deadline = from.tick + Math.round(seconds / STEP_SECONDS);
      const side = Math.sign(from.target.at.x + from.target.width / 2 - edge);
      const across = (agent: AgentSample) =>
        Math.sign(agent.at.x + agent.width / 2 - edge) === side;
      return from.agents.flatMap(({ id }) =>
        ticks
          .slice(settled)
          .some(
            ({ agents, tick }) =>
              tick <= deadline && agents.some((agent) => agent.id === id && across(agent)),
          )
          ? []
          : [
              {
                agent: id,
                detail: `not across x ${edge} within ${seconds} s of Chibi settling at tick ${from.tick}`,
                tick: Math.min(deadline, last.tick),
              },
            ],
      );
    },
    id: "rearm-crossing",
    rule: RULES.enemyPursuit,
  };
}

// Every hold of an agent kind in a committed state: it stays in place for at least seconds as
// part of its committed attack, and its cooldown starts when it leaves. A scenario-specific check;
// the scenario must complete at least one hold.
export function committedHold(
  kind: string,
  state: string,
  seconds: number,
  cooldownSeconds: number,
): Property<BossTick> {
  return {
    check: (ticks) => {
      const found: { agent: string; detail: string; tick: number }[] = [];
      let completed = 0;
      const starts = new Map<string, { at: AgentSample["at"]; episode: number; tick: number }>();
      let previous = new Map<string, AgentSample>();
      for (const tick of ticks) {
        const current = new Map<string, AgentSample>();
        for (const agent of tick.agents) {
          current.set(agent.id, agent);
          if (agent.kind !== kind) {
            continue;
          }
          const before = previous.get(agent.id);
          const start = starts.get(agent.id);
          if (agent.state === state) {
            if (before?.state !== state || start?.episode !== tick.episode) {
              starts.set(agent.id, { at: agent.at, episode: tick.episode, tick: tick.tick });
              continue;
            }
            const moved = Math.hypot(agent.at.x - start.at.x, agent.at.y - start.at.y);
            if (moved > EDGE || agent.attack?.phase !== "committed") {
              found.push({
                agent: agent.id,
                detail: `${state} moved ${moved.toFixed(1)} or left its attack`,
                tick: tick.tick,
              });
              starts.delete(agent.id);
            }
            continue;
          }
          if (!start || before?.state !== state || start.episode !== tick.episode) {
            continue;
          }
          starts.delete(agent.id);
          completed++;
          const longest = (tick.tick - start.tick + 1) * STEP_SECONDS;
          if (longest + 1e-6 < seconds) {
            found.push({
              agent: agent.id,
              detail: `${state} held at most ${longest.toFixed(3)} s < ${seconds} s`,
              tick: tick.tick,
            });
          }
          if (
            agent.attack ||
            (agent.cooldownSeconds ?? 0) + STEP_SECONDS + 1e-6 < cooldownSeconds
          ) {
            found.push({
              agent: agent.id,
              detail: `cooldown did not start when ${state} ended`,
              tick: tick.tick,
            });
          }
        }
        previous = current;
      }
      const last = ticks.at(-1);
      return completed === 0 && last
        ? [...found, { agent: kind, detail: `no completed ${state} hold`, tick: last.tick }]
        : found;
    },
    id: `committed-hold ${state}`,
    rule: `${DESIGN} Apartment building: Encounters`,
  };
}

// Every completed stay of an agent kind in a state moves it at least distance pixels
// horizontally. A scenario-specific check; the scenario must complete at least one stay.
export function movesAtLeast(kind: string, state: string, distance: number): Property<BossTick> {
  return {
    check: (ticks) => {
      const found: { agent: string; detail: string; tick: number }[] = [];
      let completed = 0;
      const stays = new Map<string, { episode: number; x: number }>();
      const before = new Map<string, AgentSample>();
      for (const tick of ticks) {
        for (const agent of tick.agents) {
          if (agent.kind !== kind) {
            continue;
          }
          const previous = before.get(agent.id);
          before.set(agent.id, agent);
          const stay = stays.get(agent.id);
          if (agent.state === state) {
            if (previous?.state !== state || stay?.episode !== tick.episode) {
              // Entered during this tick: the previous sample is where the stay began.
              stays.set(agent.id, { episode: tick.episode, x: (previous ?? agent).at.x });
            }
            continue;
          }
          if (!stay || previous?.state !== state || stay.episode !== tick.episode) {
            continue;
          }
          stays.delete(agent.id);
          completed++;
          const moved = Math.abs(previous.at.x - stay.x);
          if (moved + EDGE < distance) {
            found.push({
              agent: agent.id,
              detail: `${state} moved ${(moved / TILE).toFixed(2)} tiles`,
              tick: tick.tick,
            });
          }
        }
      }
      const last = ticks.at(-1);
      return completed === 0 && last
        ? [...found, { agent: kind, detail: `no completed ${state}`, tick: last.tick }]
        : found;
    },
    id: `moves-at-least ${state}`,
    rule: `${DESIGN} Kiwi encounter: Cycle`,
  };
}

// Every completed tell pause in the trace lasts its seconds, to within a tick. A scenario-specific
// check; the scenario must complete at least one pause. The tell-cancel-pause property checks
// that no tell starts inside it.
export function tellPauseLasts(seconds: number): Property<BossTick> {
  return {
    check: (ticks) => {
      const found: { agent: string; detail: string; tick: number }[] = [];
      let completed = 0;
      const runs = new Map<string, { episode: number; samples: number }>();
      for (const tick of ticks) {
        for (const agent of tick.agents) {
          const run = runs.get(agent.id);
          if (agent.tellPauseSeconds !== undefined) {
            if (run?.episode === tick.episode) {
              run.samples++;
            } else {
              runs.set(agent.id, { episode: tick.episode, samples: 1 });
            }
            continue;
          }
          if (!run) {
            continue;
          }
          runs.delete(agent.id);
          if (run.episode !== tick.episode || agent.pursuit === "escaped") {
            continue;
          }
          completed++;
          const lasted = run.samples * STEP_SECONDS;
          if (Math.abs(lasted - seconds) > STEP_SECONDS + 1e-6) {
            found.push({
              agent: agent.id,
              detail: `tell pause lasted ${lasted.toFixed(3)} s, not ${seconds} s`,
              tick: tick.tick,
            });
          }
        }
      }
      const last = ticks.at(-1);
      return completed === 0 && last
        ? [...found, { agent: "", detail: "no completed tell pause", tick: last.tick }]
        : found;
    },
    id: "tell-pause-lasts",
    rule: RULES.attackSequencing,
  };
}

export function bossProperties(layout: ZoneLayout): Property<BossTick>[] {
  const plans = bossPlans(layout);
  const plan = (agent: AgentSample) => plans.get(agent.kind)!;
  const watchdog = (agent: AgentSample) => plan(agent).idleWatchdog!;
  const objectOf = (agent: AgentSample) => {
    const [area, index] = agent.id.split(":");
    return layout.areas[area!]!.objects[Number(index)]!;
  };
  const committedGroundMove = (agent: AgentSample) => {
    const node = plan(agent).states[agent.state]!;
    return !flies(plan(agent)) && node.motion.kind === "move" && node.attack?.phase === "committed";
  };
  // Whether a box's bottom rests on present terrain over part of its width.
  const onTerrain = (tick: BossTick, box: Rect) =>
    layout.areas[tick.world.area]!.solids.some(
      (rect, index) =>
        !tick.world.absentTerrain.includes(index) &&
        Math.abs(rect.y - box.y - box.height) <= EDGE &&
        box.x < rect.x + rect.width &&
        rect.x < box.x + box.width,
    );
  // Engaged and ready outside the tell pause, with an attack the targeted-attack window does not
  // hold back.
  const cadenceEligible =
    (special: boolean) =>
    (tick: BossTick, agent: AgentSample): boolean => {
      if (
        agent.pursuit !== "engaged" ||
        agent.attack !== undefined ||
        (agent.cooldownSeconds ?? 0) > 0 ||
        (agent.tellPauseSeconds ?? 0) > 0
      ) {
        return false;
      }
      const deferred =
        tick.world.targetedAttackWindow === "deferred" ? (DEFERRED_ATTACKS[agent.kind] ?? []) : [];
      return [...tellAttacks(plan(agent))].some(
        (id) => (!special || id !== CHARGE_ATTACKS[agent.kind]) && !deferred.includes(id),
      );
    };
  return [
    tellPrecedesCommit(RULES.attackTells, STEP_SECONDS, (agent, id, continues) =>
      minimumTellSeconds(plan(agent), id, continues),
    ),
    tellBounded(RULES.attackTells, STEP_SECONDS, (agent, id) =>
      maximumTellSeconds(plan(agent), id),
    ),
    singleCommittedAttack(RULES.recovery),
    cooldownHonoured(
      RULES.attackSequencing,
      STEP_SECONDS,
      (agent) => plan(agent).attackCooldownSeconds!,
    ),
    cancelledTellKeepsCooldown(RULES.attackSequencing),
    tellResolves(RULES.attackSequencing),
    tellCancelPause(RULES.attackSequencing, STEP_SECONDS, (agent) => plan(agent).tellCancelPause),
    noStall(
      RULES.idleRecovery,
      STEP_SECONDS,
      STALL_BOUND.seconds,
      (agent) => watchdog(agent).minMovement,
      ({ target }, agent) => {
        if (agent.pursuit !== "engaged") {
          return false;
        }
        const gap = Math.max(
          target.at.x - (agent.at.x + agent.width),
          agent.at.x - (target.at.x + target.width),
        );
        return gap > STALL_BOUND.distance;
      },
    ),
    stillness(RULES.enemyPursuit, STEP_SECONDS, STILLNESS.graceSeconds, ({ target }, agent) => {
      if (agent.pursuit !== "engaged" || flies(plan(agent))) {
        return undefined;
      }
      const gap = Math.max(
        target.at.x - (agent.at.x + agent.width),
        agent.at.x - (target.at.x + target.width),
      );
      if (gap <= STALL_BOUND.distance) {
        return undefined;
      }
      const node = plan(agent).states[agent.state]!;
      if (node.animation === "rest") {
        return STILLNESS.recovery;
      }
      if (agent.attack) {
        return { kind: `attack-${agent.attack.phase}`, maxSeconds: Infinity };
      }
      return agent.preparing ? STILLNESS.preparation : { kind: "move", maxSeconds: 0 };
    }),
    escapeAtDistance(RULES.enemyPursuit, (agent) => plan(agent).pursuit?.escapeDistance),
    noAttackWhileEscaped(RULES.enemyPursuit),
    // A limited move, such as Trixi's slide, overshoots no farther than its authored distance.
    travelBounded(RULES.trixiRush, (agent) => {
      const { motion } = plan(agent).states[agent.state]!;
      return motion.kind === "move" && motion.distance !== undefined
        ? motion.distance + EDGE
        : undefined;
    }),
    // Twice the fastest authored speed leaves room for carrying support.
    boundedStep(RULES.enemyPursuit, (agent) => 2 * fastestSpeed(plan(agent)) * STEP_SECONDS),
    everyTick("flight-clearance", RULES.flight, (tick, agent) => {
      if (!flies(plan(agent))) {
        return undefined;
      }
      const body = insetRect(EDGE, { ...agent.at, height: agent.height, width: agent.width });
      const { absentTerrain, area } = tick.world;
      return layout.areas[area]!.solids.some(
        (rect, index) => !absentTerrain.includes(index) && rectsOverlap(body, rect),
      )
        ? `body overlaps terrain at ${agent.at.x.toFixed(1)}, ${agent.at.y.toFixed(1)}`
        : undefined;
    }),
    // A ground boss off support is in a jump or fall, so its height changes every step.
    everyTick("ground-footing", RULES.traversal, (_, agent, previous) =>
      !flies(plan(agent)) &&
      !agent.footing &&
      previous !== undefined &&
      !previous.footing &&
      Math.abs(agent.at.y - previous.at.y) <= EDGE
        ? `held at ${agent.at.x.toFixed(1)}, ${agent.at.y.toFixed(1)} without support, ${agent.state}`
        : undefined,
    ),
    // A committed ground rush stays inside the area and does not step off present support; it
    // falls only when that support has gone.
    everyTick("ledge-stop", RULES.enemyPursuit, (tick, agent, previous) => {
      if (!committedGroundMove(agent)) {
        return undefined;
      }
      const object = objectOf(agent);
      const box = contactBox(object, agent.at, agent.facing, "x");
      if (box.x < -EDGE || box.x + box.width > layout.areas[tick.world.area]!.width + EDGE) {
        return `${agent.state} past the area edge at ${agent.at.x.toFixed(1)}`;
      }
      return previous?.footing &&
        !agent.footing &&
        onTerrain(tick, contactBox(object, previous.at, previous.facing, "x"))
        ? `${agent.state} left present support at ${agent.at.x.toFixed(1)}, ${agent.at.y.toFixed(1)}`
        : undefined;
    }),
    attackCadence(
      "attack-cadence",
      RULES.attackCadence,
      STEP_SECONDS,
      CADENCE_SECONDS.any,
      () => true,
      cadenceEligible(false),
    ),
    attackCadence(
      "special-cadence",
      RULES.attackCadence,
      STEP_SECONDS,
      CADENCE_SECONDS.special,
      (agent, id) => id !== CHARGE_ATTACKS[agent.kind],
      cadenceEligible(true),
    ),
    // A boss on a stationary red hazard or below the level is dead, so no live agent is there.
    everyTick("boss-death", RULES.bossDeath, (tick, agent) => {
      const area = layout.areas[tick.world.area]!;
      const box = contactBox(objectOf(agent), agent.at, agent.facing, "x");
      if (box.y > area.height) {
        return `alive below the level at ${agent.at.x.toFixed(1)}, ${agent.at.y.toFixed(1)}`;
      }
      return area.objects.some(
        (object) =>
          object.collision === "hazard" &&
          !object.behaviour &&
          object.motion.algorithm === "static" &&
          rectsOverlap(box, {
            ...(object.hitbox ?? { height: object.height, width: object.width, x: 0, y: 0 }),
            x: object.origin.x + (object.hitbox?.x ?? 0),
            y: object.origin.y + (object.hitbox?.y ?? 0),
          }),
      )
        ? `alive on a red hazard at ${agent.at.x.toFixed(1)}, ${agent.at.y.toFixed(1)}`
        : undefined;
    }),
    // A flyer's flight and landing paths check hazards, so no flying boss dies on one.
    {
      check: (ticks) => {
        const found = new Set<string>();
        return ticks.flatMap((tick) =>
          tick.world.defeated.flatMap((id) => {
            const [area, index] = id.split(":");
            const object = layout.areas[area!]!.objects[Number(index)]!;
            if (found.has(id) || !flies(object.behaviour!)) {
              return [];
            }
            found.add(id);
            return [{ agent: id, detail: `${object.character} died`, tick: tick.tick }];
          }),
        );
      },
      id: "flyer-alive",
      rule: RULES.bossDeath,
    },
    everyTick("supported-completion", RULES.pebbleCycle, (_, agent, previous) =>
      flies(plan(agent)) &&
      previous?.attack?.phase === "committed" &&
      !agent.attack &&
      !agent.supported &&
      !previous.supported
        ? `${previous.attack.id} completed without support`
        : undefined,
    ),
    everyTick("targeted-attack-deferral", RULES.deferral, (tick, agent, previous) =>
      tick.world.targetedAttackWindow === "deferred" &&
      tellStarts(previous, agent) &&
      (DEFERRED_ATTACKS[agent.kind] ?? []).includes(agent.attack!.id)
        ? `${agent.attack!.id} tell during a deferred window`
        : undefined,
    ),
  ];
}
