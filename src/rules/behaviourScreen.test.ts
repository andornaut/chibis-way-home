import { expect, it } from "vitest";

import { namedStreams } from "../ai/randomStreams.ts";
import { EDGE } from "../core/index.ts";
import { ARCHETYPES } from "../data/archetypes.ts";
import { DOG_BEHAVIOUR, PIGEON_BEHAVIOUR } from "../data/behaviours.ts";
import { BIRD } from "../data/bird.ts";
import { CHARACTERS } from "../data/characters.ts";
import { SCREEN, TILE } from "../data/screen.ts";
import type { Archetype, BehaviourPlan, Rect } from "../data/types/index.ts";
import { type BehaviourState, startBehaviour, stepBehaviour } from "./behaviour.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import { screenBand, screenClamp } from "./behaviourScreen.ts";
import { startBird } from "./bird.ts";
import { objectLayout } from "./tiles.ts";

const archetype: Archetype = {
  collision: "hazard",
  interaction: { kind: "none", range: 0 },
  motion: {
    algorithm: "static",
    direction: "right",
    distance: 0,
    hopHeight: 0,
    pause: 0,
    speed: 0,
    variance: 0,
  },
  reaction: { kind: "none", range: 0, speed: 0 },
};
const FLOOR_ROW = 40;
const floor: Rect = { height: 2 * TILE, width: 400 * TILE, x: 0, y: FLOOR_ROW * TILE };
const dt = 1 / 60;

function boss(behaviour: BehaviourPlan, col: number) {
  return objectLayout(
    TILE,
    {
      archetypes: { actor: archetype, hazard: ARCHETYPES.hazard! },
      characters: {
        actor: { archetype: "actor", art: "actor", behaviour, cols: 3, rows: 3 },
        "pigeon-poop": CHARACTERS["pigeon-poop"]!,
      },
    },
    {},
    undefined,
    {},
    { character: "actor", col, row: FLOOR_ROW - 3 },
  );
}

// No view and no chunks, so the boss never becomes aware of Chibi and keeps wandering.
function world(solids: readonly Rect[], timeSeconds: number): BehaviourWorld {
  return {
    decisions: namedStreams(7, "screen"),
    solids,
    traversalFrame: {
      bounds: { height: 60 * TILE, width: 400 * TILE, x: 0, y: 0 },
      dtSeconds: dt,
      platforms: [],
      timeSeconds,
    },
  };
}

// Runs the boss unengaged for the given seconds with Chibi standing still, returning every
// position.
function wander(
  object: ReturnType<typeof boss>,
  solids: readonly Rect[],
  chibiX: number,
  seconds: number,
) {
  const bird = { ...startBird(BIRD, { x: chibiX, y: floor.y - BIRD.height }), grounded: true };
  let state: BehaviourState = startBehaviour(BIRD, object, bird),
    at = object.origin;
  const xs: number[] = [];
  for (let tick = 0; tick * dt < seconds; tick++) {
    const step = stepBehaviour(BIRD, object, world(solids, tick * dt), dt, bird, at, state);
    expect(step.state.pursuit?.phase).toBeUndefined();
    state = step.state;
    at = step.at;
    xs.push(at.x);
  }
  return { band: screenBand(BIRD, bird, object)!, xs };
}

it("keeps a move inside Chibi's screen, and a body outside it from moving farther out", () => {
  const object = boss(DOG_BEHAVIOUR, 100);
  const band = screenBand(BIRD, { x: 100 * TILE }, object)!;
  const centre = 100 * TILE + BIRD.width / 2;
  expect(band.low).toBe(centre - SCREEN.width / 2 + TILE);
  expect(band.high + object.width).toBe(centre + SCREEN.width / 2 - TILE);
  expect(screenClamp(band, band.low + TILE, band.low - 5 * TILE)).toBe(band.low);
  expect(screenClamp(band, band.high, band.low + TILE)).toBe(band.low + TILE);
  // From outside, only toward the screen: home nearer to Chibi is still reachable.
  const outside = band.low - 10 * TILE;
  expect(screenClamp(band, outside, outside - 4 * TILE)).toBe(outside);
  expect(screenClamp(band, outside, outside + 4 * TILE)).toBe(outside + 4 * TILE);
});

it("walks a ground wander 1 to 2 tiles within 4 tiles of its spawn", () => {
  const object = boss(DOG_BEHAVIOUR, 100);
  const { xs } = wander(object, [floor], 300 * TILE, 30);
  const offsets = xs.map((x) => (x - object.origin.x) / TILE);
  expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(4 + EDGE);
  // Each walk ends where the boss holds; consecutive holds lie 0.5 to 2 tiles apart.
  const holds = xs.filter((x, index) => index > 0 && x === xs[index - 1]);
  const stops = holds.filter((x, index) => index === 0 || x !== holds[index - 1]);
  const walks = stops.slice(1).map((x, index) => Math.abs(x - stops[index]!) / TILE);
  expect(walks.length).toBeGreaterThan(5);
  expect(Math.max(...walks)).toBeLessThanOrEqual(2 + EDGE);
});

it.each([
  ["a wandering ground boss", DOG_BEHAVIOUR],
  ["Pebble's wander hops", PIGEON_BEHAVIOUR],
] as const)("keeps %s on Chibi's screen next to its edge", (_, plan) => {
  const object = boss(plan, 100);
  // Chibi's screen ends a tile and a half left of the boss's spawn.
  const probe = screenBand(BIRD, { x: 0 }, object)!;
  const chibiX = object.origin.x - 1.5 * TILE - probe.low - startBird(BIRD, { x: 0, y: 0 }).x;
  const { band, xs } = wander(object, [floor], chibiX, 30);
  expect(band.low).toBeCloseTo(object.origin.x - 1.5 * TILE);
  for (const x of xs) {
    expect(x).toBeGreaterThanOrEqual(band.low - EDGE);
    expect(x).toBeLessThanOrEqual(band.high + EDGE);
  }
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(TILE - EDGE);
});
