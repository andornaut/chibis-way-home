import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { namedStreams } from "../ai/randomStreams";
import { canonicalTrace, traceRecorder } from "../ai/trace";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { ObjectLayout } from "../data/types";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { type BehaviourState, startBehaviour, stepBehaviour } from "./behaviour";
import type { BehaviourWorld } from "./behaviourReach";
import { startBird, stepBird } from "./bird";
import { objectLayout } from "./tiles";

// Every boss graph state, entered engaged against a Chibi who walks onto the boss's sampled
// approach target. Each run's per-step output must hash to the value recorded before its
// motion moved into an ability, which covers the swoop, burst, drop and pounce paths that the
// zone scenarios do not reach. BEHAVIOUR_TRACE_UPDATE=1 re-records.
const FIXTURE = new URL("./fixtures/behaviourAbilityTraces.json", import.meta.url);
const UPDATE = process.env.BEHAVIOUR_TRACE_UPDATE === "1";
const CHARACTERS = [
  "bear-antagonist",
  "dog-antagonist",
  "ferret-antagonist",
  "goose-antagonist",
  "pigeon-antagonist",
  "raccoon-antagonist",
] as const;
// Archie's and Pebble's graphs with plain pursuit in place of planner traversal and the overhead
// approach, with and without sampled intent: no production boss chases that way.
const VARIANTS = [
  "dog-antagonist plain-live",
  "dog-antagonist plain-sampled",
  "pigeon-antagonist plain-sampled",
  "pigeon-antagonist plain-live",
] as const;
const TICKS = 720;

function variant(name: (typeof CHARACTERS)[number] | (typeof VARIANTS)[number]): ObjectLayout {
  const [character, flight] = name.split(" ") as [(typeof CHARACTERS)[number], string?];
  const object = objectLayout(
    TILE,
    CATALOGUE,
    HITBOXES,
    TILESETS["tiles-street"],
    {},
    { character, col: 10, row: 14 },
  );
  if (!flight) {
    return object;
  }
  const plan = object.behaviour!;
  const states = Object.fromEntries(
    Object.entries(plan.states).map(([key, node]) => {
      const motion = node.motion;
      if (motion.kind !== "pursue") {
        return [key, node];
      }
      const plain = {
        kind: "pursue" as const,
        mode: motion.mode,
        speed: motion.speed,
        ...(flight === "plain-sampled" && motion.intent && { intent: motion.intent }),
      };
      return [key, { ...node, motion: plain }];
    }),
  );
  // Plain ground pursuit neither falls nor climbs, so it starts on the floor.
  const grounded = Object.values(plan.states).some(
    ({ motion }) => motion.kind === "pursue" && motion.mode === "ground",
  );
  return {
    ...object,
    behaviour: { ...plan, states },
    ...(grounded && { origin: { x: object.origin.x, y: floor.y - object.height } }),
  };
}
const DT = 1 / 120;

const floor = { height: 360, width: 1440, x: 0, y: 720 };
const roof = { height: 12, width: 240, x: 600, y: 600 };
const ledge = { height: 24, width: 144, x: 360, y: 600 };

function world(covered: boolean, tick: number): BehaviourWorld {
  return {
    decisions: namedStreams(1, "ability-trace:0"),
    solids: covered ? [floor, roof, ledge] : [floor],
    targetedAttackWindow: "allowed",
    traversalFrame: {
      bounds: { height: 1080, width: 1440, x: 0, y: 0 },
      dtSeconds: DT,
      platforms: [],
      timeSeconds: tick * DT,
    },
    view: { height: 720, width: 1440, x: 0, y: 360 },
  };
}

function motionName(object: ObjectLayout, state: BehaviourState): string {
  const motion = object.behaviour!.states[state.stateKey]!.motion;
  if (motion.kind === "fly") {
    return `fly:${typeof motion.to === "string" ? motion.to : "point"}`;
  }
  if (motion.kind === "pursue") {
    return `pursue:${motion.mode}${motion.mode === "fly" && motion.overhead ? "-overhead" : ""}`;
  }
  return motion.kind;
}

interface Coverage {
  readonly actions: Set<string>;
  readonly motions: Set<string>;
  readonly phases: Set<string>;
}

function run(
  object: ObjectLayout,
  entry: string,
  covered: boolean,
  start: "aligned" | "escaped" | "origin" | "pacing",
  coverage: Coverage,
) {
  const recorder = traceRecorder({ retain: false });
  let bird = startBird(BIRD, { x: object.origin.x + 240, y: floor.y - BIRD.height });
  // Aligned starts hold the boss at its overhead approach goal above Chibi.
  const overhead = Object.values(object.behaviour!.states)
    .map(({ motion }) => motion)
    .find((motion) => motion.kind === "pursue" && motion.mode === "fly" && motion.overhead);
  let at =
    start !== "origin" &&
    overhead?.kind === "pursue" &&
    overhead.mode === "fly" &&
    overhead.overhead
      ? {
          x: bird.x + BIRD.width / 2 + overhead.overhead.ahead - object.width / 2,
          y: bird.y - overhead.overhead.clearance - object.height,
        }
      : object.origin;
  const attack = object.behaviour!.states[entry]!.attack;
  // Entered as the graph would hold it: engaged, with a captured approach side and, past a
  // tell, its committed attack.
  let state: BehaviourState = {
    ...startBehaviour(BIRD, object, bird),
    ...(attack &&
      attack.phase !== "tell" && { activeAttack: { id: attack.id, phase: "committed" as const } }),
    anchor: at,
    elapsed: 0,
    flightApproachDirection: 1,
    pendingEntry: true,
    // An escaped start holds the flier airborne above Chibi, so it settles onto support.
    pursuit: {
      phase: start === "escaped" ? "escaped" : "engaged",
      settled: false,
      unreachableSeconds: 0,
    },
    stateKey: entry,
  };
  for (let tick = 0; tick < TICKS; tick++) {
    const physical = world(covered, tick);
    const aim = state.intent?.target.x ?? state.flightTarget?.x;
    // Pacing walks under the boss and back, so sampled approaches cross Chibi's live goal.
    const move =
      start === "pacing"
        ? Math.floor(tick / 90) % 2 === 0
          ? -1
          : 1
        : aim === undefined || Math.abs(aim - bird.x) < 4
          ? 0
          : aim < bird.x
            ? -1
            : 1;
    bird = stepBird(BIRD, physical.solids, [], DT, { jumpHeld: false, move }, bird);
    let step: ReturnType<typeof stepBehaviour>;
    try {
      step = stepBehaviour(BIRD, object, physical, DT, bird, at, state);
    } catch (error) {
      recorder.record(`throws ${(error as Error).message}`);
      break;
    }
    recorder.record(canonicalTrace(() => undefined, step));
    for (const { action } of step.actions) {
      coverage.actions.add(`${object.character}:${action.kind}`);
    }
    coverage.motions.add(`${object.character}:${motionName(object, step.state)}`);
    if (step.state.activeAttack) {
      coverage.phases.add(`${object.character}:${step.state.activeAttack.phase}`);
    }
    at = step.at;
    state = step.state;
  }
  return recorder.hash();
}

describe("behaviour ability traces", () => {
  const coverage: Coverage = { actions: new Set(), motions: new Set(), phases: new Set() };
  const observed: Record<string, string> = {};
  const baseline: Readonly<Record<string, string>> = existsSync(FIXTURE)
    ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, string>)
    : {};

  it.each([...CHARACTERS, ...VARIANTS])(
    "%s reproduces every entry state's recorded trace",
    (character) => {
      const object = variant(character);
      for (const entry of Object.keys(object.behaviour!.states).sort()) {
        for (const covered of [false, true]) {
          const starts =
            character === "pigeon-antagonist"
              ? (["origin", "aligned", "escaped", "pacing"] as const)
              : (["origin"] as const);
          for (const start of starts) {
            const suffix = start === "origin" ? "" : ` ${start}`;
            const name = `${character} ${entry} ${covered ? "covered" : "open"}${suffix}`;
            observed[name] = run(object, entry, covered, start, coverage);
            if (!UPDATE) {
              expect(observed[name], name).toBe(baseline[name]);
            }
          }
        }
      }
    },
    600_000,
  );

  it("reaches the swoop, burst, drop, pounce and entry-effect paths", () => {
    if (UPDATE) {
      const sorted = Object.entries(observed).sort(([a], [b]) => (a < b ? -1 : 1));
      writeFileSync(FIXTURE, `${JSON.stringify(Object.fromEntries(sorted), null, 2)}\n`);
    } else {
      expect(Object.keys(observed).sort()).toEqual(Object.keys(baseline).sort());
    }
    console.info(
      "Ability trace coverage",
      JSON.stringify({
        actions: [...coverage.actions].sort(),
        motions: [...coverage.motions].sort(),
        phases: [...coverage.phases].sort(),
      }),
    );
    for (const required of [
      "pigeon-antagonist:fly:target",
      "pigeon-antagonist:fly:target-x",
      "pigeon-antagonist:fly:support",
      "pigeon-antagonist:pursue:fly-overhead",
    ]) {
      expect(coverage.motions).toContain(required);
    }
    expect(coverage.phases).toContain("pigeon-antagonist:committed");
    expect(coverage.actions).toContain("pigeon-antagonist:spawn");
  });
});
