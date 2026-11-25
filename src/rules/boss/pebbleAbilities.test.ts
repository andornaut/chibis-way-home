import { expect, it } from "vitest";

import { namedStreams } from "../../ai/randomStreams.ts";
import { BIRD } from "../../data/bird.ts";
import { TILE } from "../../data/screen.ts";
import type { ObjectLayout } from "../../data/types/index.ts";
import { stepBehaviour } from "../../testing/behaviourStep.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../../testing/walkSuite.ts";
import { startBird, stepBird } from "../bird/bird.ts";
import { objectLayout } from "../stage/tiles.ts";
import { type BehaviourState, startBehaviour } from "./behaviour.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";

// Pebble's graph states, each entered engaged against a Chibi who walks onto Pebble's sampled
// approach target, reach the targeted flights, overhead pursuit, supported landing, committed
// attack and spawn that the zone scenarios do not reach.
const CHARACTERS = ["pigeon-antagonist"] as const;
// Pebble's graph with plain pursuit in place of the overhead approach: no production boss chases
// that way.
const VARIANTS = ["pigeon-antagonist plain"] as const;
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
): void {
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
    const step = stepBehaviour(BIRD, object, physical, DT, bird, at, state);
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
}

it("reaches Pebble's targeted flights, overhead pursuit, landing, committed attack and spawn", () => {
  const coverage: Coverage = { actions: new Set(), motions: new Set(), phases: new Set() };
  for (const character of [...CHARACTERS, ...VARIANTS]) {
    const object = variant(character);
    for (const entry of Object.keys(object.behaviour!.states).sort()) {
      for (const covered of [false, true]) {
        const starts =
          character === "pigeon-antagonist"
            ? (["origin", "aligned", "escaped", "pacing"] as const)
            : (["origin"] as const);
        for (const start of starts) {
          run(object, entry, covered, start, coverage);
        }
      }
    }
  }
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
}, 600_000);
