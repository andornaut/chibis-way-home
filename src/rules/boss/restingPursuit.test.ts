import { expect, it } from "vitest";

import { namedStreams } from "../../ai/randomStreams.ts";
import { BIRD } from "../../data/bird.ts";
import { TILE } from "../../data/screen.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../../testing/walkSuite.ts";
import { startBird } from "../bird/bird.ts";
import { objectLayout } from "../stage/tiles.ts";
import { type BehaviourState, startBehaviour } from "./behaviour.ts";
import { stepBehaviour } from "./encounter.ts";

// A boss lodged at the mouth of a low nook: his hitbox rests on the end of the nook's step,
// overhanging it, pressed against the end of the nook's roof. Chibi waits inside, out of his
// reach. Gravity leaves him in place, but the planner finds no support spanning his body.
const floor = { height: 120, width: 2400, x: -600, y: 600 };
const step = { height: 24, width: 120, x: 336, y: 576 };
const roof = { height: 12, width: 72, x: 360, y: 528 };
const world = {
  decisions: namedStreams(1, "resting-pursuit"),
  solids: [floor, step, roof],
  targetedAttackWindow: "allowed" as const,
  traversalFrame: {
    bounds: { height: 720, width: 2400, x: -600, y: 0 },
    dtSeconds: 1 / 120,
    platforms: [],
    timeSeconds: 0,
  },
  view: { height: 720, width: 1440, x: 0, y: 0 },
};
const SECONDS = 1 / 120;

function lodged(character: string) {
  const object = objectLayout(
    TILE,
    CATALOGUE,
    HITBOXES,
    TILESETS["tiles-street"],
    {},
    { character, col: 36, row: 44 },
  );
  const hitbox = object.hitbox!;
  const at = { x: roof.x + roof.width - hitbox.x, y: step.y - hitbox.y - hitbox.height };
  const bird = startBird(BIRD, { x: roof.x + TILE, y: step.y });
  const state: BehaviourState = {
    ...startBehaviour(BIRD, object, bird),
    attackCooldownRemainingSeconds: 60,
    idleWatchdog: { anchor: at, seconds: 0 },
    pendingEntry: false,
    pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
    stateKey: "pursuit",
    traversal: {
      geometry: "",
      inputs: [],
      physical: { fallFromY: at.y + object.height, grounded: false, vy: 0, ...at },
      status: "geometry-unavailable",
      target: { height: 3 * TILE, width: 2 * TILE, x: roof.x, y: step.y - 3 * TILE },
    },
  };
  return { at, bird, object, state };
}

it.each(["dog-antagonist", "ferret-antagonist"])(
  "lets a pursuer lodged on a part-supported ledge choose again on the next tick (%s)",
  (character) => {
    const { at, bird, object, state } = lodged(character);
    expect(object.hitbox!.width).toBeGreaterThan(step.x + step.width - (roof.x + roof.width));
    const next = stepBehaviour(BIRD, object, world, SECONDS, bird, at, state);
    // His last move's hold has run out, so the next tick is a decision boundary.
    expect(next.state.scorer?.decision).toBe((state.scorer?.decision ?? 0) + 1);
    expect(next.state.intent?.remainingSeconds).toBeGreaterThan(0);
  },
);

it.each(["dog-antagonist", "ferret-antagonist"])(
  "moves a lodged pursuer half a tile within the idle watchdog's stall time (%s)",
  (character) => {
    const start = lodged(character);
    const { bird, object } = start;
    let { at, state } = start;
    // Layout units: seconds, and pixels for the minimum movement. Recovery walks at chase speed,
    // so half a second after the stall time covers it.
    const watchdog = object.behaviour!.idleWatchdog!;
    const ticks = Math.ceil((watchdog.seconds + 0.5) / SECONDS);
    let moved: number | undefined;
    for (let tick = 1; tick <= ticks && moved === undefined; tick++) {
      const next = stepBehaviour(BIRD, object, world, SECONDS, bird, at, state);
      at = next.at;
      state = next.state;
      if (Math.abs(at.x - start.at.x) >= watchdog.minMovement) {
        moved = tick;
      }
    }
    expect(moved).toBeDefined();
  },
);
