import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { AreaLayout, Motion, ObjectLayout, Point, ZoneLayout } from "../data/types";
import { zoneSurfaces } from "../sim/zoneWalk";
import { TEST_PURSUER, TEST_SHUTTLE } from "../testing/behaviours";
import { BIRD_FRAME } from "../view/bird";
import { birdBox, birdFrameRect, startBird } from "./bird";
import { STEP_SECONDS } from "./step";
import {
  activateBehaviour,
  doorAt,
  enterArea,
  leaveRoom,
  objectStep,
  retryZone,
  roomOf,
  standsOn,
  startZone,
  stepZone,
  type ZoneInput,
  type ZoneState,
} from "./zone";

const STEP = STEP_SECONDS;
const SEED = 42;
const GROUND = { height: 40, width: 1100, x: 0, y: 300 };
const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };
const RIGHT: ZoneInput = { ...STILL, move: 1 };
const LEFT: ZoneInput = { ...STILL, move: -1 };
const STATIC: Motion = {
  algorithm: "static",
  direction: "right",
  distance: 0,
  hopHeight: 0,
  pause: 0,
  speed: 0,
  variance: 0,
};

function object(fields: Partial<ObjectLayout> & { origin: Point }): ObjectLayout {
  return {
    animations: {
      idle: undefined,
      move: undefined,
      open: undefined,
      react: undefined,
      talk: undefined,
    },
    art: "block",
    character: "block",
    collision: "solid",
    height: 12,
    hitbox: undefined,
    interaction: { kind: "none", range: 0 },
    lines: [],
    motion: STATIC,
    phase: 0,
    quips: [],
    quirks: [],
    reaction: { kind: "none", range: 0, speed: 0 },
    room: undefined,
    scene: undefined,
    width: 48,
    ...fields,
  };
}

function area(objects: readonly ObjectLayout[], fields: Partial<AreaLayout> = {}): AreaLayout {
  return {
    backX: 12,
    chunks: [],
    entries: { start: { x: 100, y: GROUND.y } },
    exitX: GROUND.width - 12,
    height: 360,
    objects,
    solids: [GROUND],
    terrain: [],
    tileset: undefined,
    width: 1100,
    ...fields,
  };
}

const zone = (main: AreaLayout, others: Record<string, AreaLayout> = {}): ZoneLayout => ({
  areas: { main, ...others },
  birdFrame: BIRD_FRAME,
  start: { area: "main", entry: "start" },
});

function run(
  layout: ZoneLayout,
  seconds: number,
  input: ZoneInput | ((step: number) => ZoneInput),
): ZoneState[] {
  let state = startZone(BIRD, layout, SEED);
  const states = [state];
  for (let step = 0; step < Math.round(seconds / STEP); step++) {
    state = stepZone(BIRD, layout, STEP, typeof input === "function" ? input(step) : input, state);
    states.push(state);
  }
  return states;
}

const bottomOf = (state: ZoneState | undefined) => (state?.bird.y ?? 0) + BIRD.height;

describe("behaviour encounters", () => {
  const patrol = object({
    behaviour: {
      ...TEST_PURSUER,
      distance: -100,
      initial: "watchLeft",
      states: {
        ...TEST_PURSUER.states,
        burst: {
          animation: "rush",
          motion: { direction: "facing", kind: "move", speed: 10000 },
          transitions: [{ to: "recover", when: [{ kind: "elapsed", seconds: 0.5 }] }],
        },
      },
    },
    collision: "hazard",
    height: 20,
    motion: { ...STATIC, algorithm: "linear", direction: "left", distance: 100, speed: 20 },
    origin: { x: 150, y: 280 },
    scene: "first-encounter",
    width: 12,
  });
  const layout = zone(area([patrol]));

  it("activates after its conversation and resets inactive on the next attempt", () => {
    const initial = startZone(BIRD, layout, SEED);
    expect(initial.behaviours[0]?.active).toBe(false);
    const active = activateBehaviour(0, initial);
    expect(active.behaviours[0]?.active).toBe(true);
    const dead = stepZone(BIRD, layout, STEP, STILL, {
      ...active,
      bird: { ...active.bird, x: patrol.origin.x, y: patrol.origin.y },
    });
    expect(dead.death?.reason).toBe("hazard");
    const reset = retryZone(BIRD, layout, dead);
    expect(reset.attempt).toBe(initial.attempt + 1);
    expect(reset.behaviours[0]).toEqual(initial.behaviours[0]);
  });

  it.each(["brace", "watchLeft", "recover", "burst"])("is lethal during %s", (stateKey) => {
    const initial = activateBehaviour(0, startZone(BIRD, layout, SEED));
    const charge = initial.behaviours[0];
    if (!charge) {
      throw new Error("Missing fixture behaviour");
    }
    const result = stepZone(BIRD, layout, STEP, STILL, {
      ...initial,
      behaviours: [{ ...charge, stateKey }],
      bird: { ...initial.bird, x: patrol.origin.x, y: patrol.origin.y },
    });
    expect(result.death?.reason).toBe("hazard");
  });

  it("detects a rush that crosses the bird entirely between fixed frames", () => {
    const initial = activateBehaviour(0, startZone(BIRD, layout, SEED));
    const charge = initial.behaviours[0];
    if (!charge) {
      throw new Error("Missing fixture behaviour");
    }
    const result = stepZone(BIRD, layout, STEP, STILL, {
      ...initial,
      behaviours: [{ ...charge, stateKey: "burst" }],
    });
    expect(result.death?.reason).toBe("hazard");
  });

  it("carries the bird on an inanimate platform using the same state executor", () => {
    const lift = object({
      behaviour: TEST_SHUTTLE,
      collision: "solid",
      origin: { x: 80, y: 260 },
      width: 72,
    });
    const layout = zone(area([lift], { entries: { start: { x: 100, y: 260 } } }));
    const initial = startZone(BIRD, layout, SEED);
    expect(zoneSurfaces(BIRD, layout).some((surface) => surface.mover === 0)).toBe(true);
    const next = stepZone(BIRD, layout, 0.1, STILL, initial);
    expect(next.objects[0]?.y).toBe(257);
    expect(next.bird.y + BIRD.height).toBe(257);
    expect(next.restarts).toBe(0);
    expect(next.behaviours[0]?.stateKey).toBe(TEST_SHUTTLE.initial);
  });
});

describe("restarts", () => {
  const narrow = area([], { solids: [{ ...GROUND, width: 200 }] });
  const hazard = object({
    collision: "hazard",
    height: 8,
    origin: { x: 150, y: GROUND.y - 8 },
    width: 20,
  });
  it.each([
    ["falling out of the area", zone(narrow)],
    ["touching a hazard", zone(area([hazard]))],
  ])("after %s, freezes the failed attempt until an explicit retry", (_, layout) => {
    const states = run(layout, 3, RIGHT);
    const dead = states.find((state) => state.death !== undefined);
    expect(dead).toBeDefined();
    if (!dead) {
      throw new Error("Fixture did not reach death");
    }
    expect(stepZone(BIRD, layout, STEP, RIGHT, dead)).toBe(dead);
    expect(dead.attempt).toBe(0);
    expect(dead.seconds).toBeGreaterThan(0);
    expect(dead.death?.position).toEqual({ x: dead.bird.x, y: dead.bird.y });
    const restart = retryZone(BIRD, layout, dead);
    expect(restart.bird).toEqual(startBird(BIRD, { x: 100, y: GROUND.y }));
    expect([restart.attempt, restart.seconds, restart.restarts, restart.death]).toEqual([
      1,
      0,
      1,
      undefined,
    ]);
    expect(retryZone(BIRD, layout, restart)).toBe(restart);
  });

  // A hazard drawn 48 wide whose art touches only its middle 8, from x 150 to 158.
  const boxed = object({
    collision: "hazard",
    height: 24,
    hitbox: { height: 24, width: 8, x: 20, y: 0 },
    origin: { x: 130, y: GROUND.y - 24 },
  });
  it.each([
    ["its rectangle but not its hit box", 128, false],
    ["its hit box", 154, true],
  ])("standing in %s ends the attempt: %s", (_, x, restarts) => {
    const layout = zone(area([boxed], { entries: { start: { x, y: GROUND.y } } }));
    expect(run(layout, 0.1, STILL).some((state) => state.death !== undefined)).toBe(restarts);
  });
});

describe("ledges", () => {
  const ledge = object({ collision: "ledge", origin: { x: 0, y: GROUND.y - 60 }, width: 200 });
  it.each([
    ["jumps up through from below and lands on top", true, ledge.origin.y],
    ["stands on the ground while never jumping", false, GROUND.y],
  ])("she %s", (_, jumps, top) => {
    const states = run(zone(area([ledge])), 2, (step) => ({
      ...STILL,
      jumpHeld: jumps && step < 30,
    }));
    expect(bottomOf(states.at(-1))).toBe(top);
  });
});

describe("moving platforms", () => {
  const platform = (direction: Motion["direction"]) =>
    object({
      motion: { ...STATIC, algorithm: "linear", direction, distance: 200, speed: 30 },
      origin: { x: 60, y: GROUND.y - 24 },
      width: 96,
    });
  const onPlatform = (mover: ObjectLayout) =>
    zone(
      area([mover], {
        entries: { start: { x: mover.origin.x + mover.width / 2, y: mover.origin.y } },
      }),
    );

  it.each(["right", "up"] as const)("carries her %s while she stands on it", (direction) => {
    const states = run(onPlatform(platform(direction)), 1.5, STILL);
    const last = states.at(-1);
    const at = last?.objects[0];
    expect(last && at && standsOn(BIRD, last.bird, { ...at, height: 12, width: 96 })).toBe(true);
  });

  it("keeps its speed along x when she jumps off, until she lands", () => {
    const states = run(onPlatform(platform("right")), 3, (step) => ({
      ...STILL,
      jumpHeld: step >= 60 && step < 64,
    }));
    const airborne = states.filter((state) => !state.bird.grounded && state.steps > 60);
    expect(airborne.length).toBeGreaterThan(0);
    for (const state of airborne) {
      expect(state.bird.carryVx).toBeCloseTo(30, 9);
    }
    expect(states.at(-1)?.bird.carryVx).toBe(0);
  });
});

describe("pushes", () => {
  // A block 48 wide on the ground, level with her side; she starts at x 100 (her box 88 to 112).
  const block = (x: number, direction?: Motion["direction"]) =>
    object({
      height: 24,
      motion: direction
        ? { ...STATIC, algorithm: "linear", direction, distance: 200, speed: 60 }
        : STATIC,
      origin: { x, y: GROUND.y - 24 },
    });
  const wall = { height: 100, width: 40, x: 20, y: GROUND.y - 100 };
  const leftEdge = (state: ZoneState) => state.objects[0]?.x ?? 0;
  const rightEdge = (state: ZoneState) => leftEdge(state) + 48;

  it.each([
    [
      "standing still, hit from the left by a block moving right, ahead of it",
      block(20, "right"),
      STILL,
      (state: ZoneState) => state.bird.x - rightEdge(state),
    ],
    [
      "standing still, hit from the right by a block moving left, ahead of it",
      block(140, "left"),
      STILL,
      (state: ZoneState) => state.bird.x + BIRD.width - leftEdge(state),
    ],
    [
      "running right into a still block, stopped at its side",
      block(140),
      RIGHT,
      (state: ZoneState) => state.bird.x + BIRD.width - leftEdge(state),
    ],
    [
      "running right into a block moving left toward her, at its side",
      block(200, "left"),
      RIGHT,
      (state: ZoneState) => state.bird.x + BIRD.width - leftEdge(state),
    ],
  ])("ends %s", (_, mover, input, gap) => {
    const states = run(zone(area([mover])), 1.5, input);
    expect(states.every((state) => state.death === undefined)).toBe(true);
    expect(gap(states.at(-1) as ZoneState)).toBeCloseTo(0, 9);
  });

  it("ends the attempt when a block pushes her into a wall", () => {
    const layout = zone(area([block(140, "left")], { solids: [GROUND, wall] }));
    expect(run(layout, 3, STILL).some((state) => state.death !== undefined)).toBe(true);
  });
});

describe("clearing", () => {
  // Her box's right edge at x, standing on the ground.
  const at = (x: number) => {
    const start = startZone(BIRD, zone(area([])), SEED);
    return { ...start, bird: { ...start.bird, x: x - BIRD.width } };
  };
  const exitX = GROUND.width - 12;
  it.each([
    ["her box reaching past the last column's left edge", exitX + 1, true],
    ["her box ending at the last column's left edge", exitX, false],
  ])("standing still with %s: cleared %s", (_, right, cleared) => {
    const layout = zone(area([]));
    expect(stepZone(BIRD, layout, STEP, STILL, at(right)).cleared).toBe(cleared);
  });

  it("clears at any height, in the air above the last column", () => {
    const layout = zone(area([]));
    const high = at(exitX + 1);
    const state = { ...high, bird: { ...high.bird, grounded: false, y: 20 } };
    expect(stepZone(BIRD, layout, STEP, STILL, state).cleared).toBe(true);
  });

  it("runs right to the edge, clears, and then holds still", () => {
    const states = run(zone(area([])), 6, RIGHT);
    const first = states.findIndex((state) => state.cleared);
    expect(first).toBeGreaterThan(0);
    expect(states.at(-1)).toBe(states[first]);
  });
});

describe("turning back", () => {
  // Her box's left edge at x, standing on the ground.
  const at = (x: number) => {
    const start = startZone(BIRD, zone(area([])), SEED);
    return { ...start, bird: { ...start.bird, x } };
  };
  const backX = 12;
  it.each([
    ["her box reaching back past the first column's right edge", backX - 1, true],
    ["her box starting at the first column's right edge", backX, false],
  ])("standing still with %s: turned back %s", (_, left, turnedBack) => {
    const next = stepZone(BIRD, zone(area([])), STEP, STILL, at(left));
    expect({ cleared: next.cleared, turnedBack: next.turnedBack }).toEqual({
      cleared: false,
      turnedBack,
    });
  });

  it("runs left to the edge, turns back, and then holds still", () => {
    const states = run(zone(area([])), 6, LEFT);
    const first = states.findIndex((state) => state.turnedBack);
    expect(first).toBeGreaterThan(0);
    expect(states.at(-1)).toBe(states[first]);
  });

  it("starts each attempt afresh, not turned back", () => {
    expect(startZone(BIRD, zone(area([])), SEED).turnedBack).toBe(false);
  });
});

describe("doorAt", () => {
  // She stands on the ground at x 100; her drawn frame is wider and taller than her box.
  const bird = startBird(BIRD, { x: 100, y: GROUND.y });
  const frame = birdFrameRect(BIRD, BIRD_FRAME, bird);
  const box = birdBox(BIRD, bird);
  const door = (x: number, y: number, width = 24, height = 48) =>
    object({ collision: "use", height, origin: { x, y }, width });
  const at = (objects: readonly ObjectLayout[]) => objects.map(({ origin }) => origin);
  const opened = (objects: readonly ObjectLayout[]) =>
    doorAt(BIRD, BIRD_FRAME, objects, at(objects), bird);

  it.each([
    ["overlapping 1 px past her frame's right edge", door(frame.x + frame.width - 1, frame.y), 0],
    ["just touching her frame's right edge", door(frame.x + frame.width, frame.y), undefined],
    ["overlapping 1 px past her frame's left edge", door(frame.x - 24 + 1, frame.y), 0],
    ["just touching her frame's left edge", door(frame.x - 24, frame.y), undefined],
    ["overlapping 1 px above her frame's top", door(frame.x, frame.y - 48 + 1), 0],
    ["just touching her frame's top", door(frame.x, frame.y - 48), undefined],
    // Past her collision box but under her drawn frame: the forgiving reach.
    ["under her frame but clear of her box", door(box.x + box.width + 1, frame.y), 0],
  ])("opens a door %s: %s", (_, placed, index) => {
    expect(opened([placed])).toBe(index);
  });

  it("opens no door for anything but a door under her frame", () => {
    expect(opened([{ ...door(frame.x, frame.y), collision: "solid" }])).toBeUndefined();
  });

  // Two doors under her frame: the one whose centre is nearer hers.
  it.each([
    [
      "the left one nearer",
      [door(frame.x - 20, frame.y), door(frame.x + frame.width - 1, frame.y)],
      0,
    ],
    [
      "the right one nearer",
      [door(frame.x - 23, frame.y), door(box.x + box.width - 4, frame.y)],
      1,
    ],
  ])("of two doors, opens %s", (_, objects, index) => {
    expect(opened(objects)).toBe(index);
  });
});

describe("doors", () => {
  const door = object({
    collision: "use",
    height: 48,
    origin: { x: 80, y: GROUND.y - 48 },
    room: "parlour",
    width: 24,
  });
  const press = (step: number) => ({ ...STILL, useHeld: step >= 10 });

  it.each([
    ["Use at a door opens its room", [door], press, "parlour"],
    [
      "Use away from every door does nothing",
      [{ ...door, origin: { x: 400, y: 252 } }],
      press,
      undefined,
    ],
    [
      "Use held since before she arrived does nothing",
      [door],
      () => ({ ...STILL, useHeld: true }),
      undefined,
    ],
  ])("%s", (_, objects, input, room) => {
    const layout = zone(area(objects));
    expect(roomOf(layout, run(layout, 0.5, input).at(-1) as ZoneState)).toBe(room);
  });

  it("holds the zone still while the room shows", () => {
    const states = run(zone(area([door])), 0.5, press);
    const opened = states.findIndex((state) => state.door !== undefined);
    expect(states.at(-1)).toBe(states[opened]);
  });

  it("leaves the room with her where she was, and steps on from there", () => {
    const layout = zone(area([door]));
    const inside = run(layout, 0.5, press).at(-1) as ZoneState;
    const back = leaveRoom(inside);
    expect([back.door, back.bird, back.objects, back.seconds]).toEqual([
      undefined,
      inside.bird,
      inside.objects,
      inside.seconds,
    ]);
    const next = stepZone(BIRD, layout, STEP, { ...STILL, useHeld: true }, back);
    expect([next.door, next.seconds]).toEqual([undefined, inside.seconds + STEP]);
  });
});

describe("objectStep", () => {
  const bird = startBird(BIRD, { x: 100, y: GROUND.y });
  // A 24 px block whose path is at x 150 on the ground, 50 px right of her centre.
  const at = { x: 138, y: GROUND.y - 24 };
  const critter = (kind: "approach" | "avoid" | "none", range: number) =>
    object({ height: 24, origin: at, reaction: { kind, range, speed: 120 }, width: 24 });
  it.each([
    [
      "without a reaction, follows its path",
      critter("none", 0),
      { x: 200, y: at.y },
      { x: 200, y: at.y },
    ],
    ["avoiding her in range, moves away", critter("avoid", 80), at, { x: at.x + 1, y: at.y }],
    [
      "approaching her in range, moves toward her",
      critter("approach", 80),
      at,
      { x: at.x - 1, y: at.y },
    ],
    [
      "out of range, heads back to its path",
      critter("avoid", 20),
      { x: 160, y: at.y },
      { x: at.x + 1, y: at.y },
    ],
    [
      "out of range and near its path, rejoins it",
      critter("avoid", 20),
      { x: at.x + 0.5, y: at.y },
      { x: at.x + 0.5, y: at.y },
    ],
  ])("%s", (_, critterLayout, path, next) => {
    const moved = objectStep(BIRD, critterLayout, 1 / 120, path, bird, at);
    expect(moved.x).toBeCloseTo(next.x, 9);
    expect(moved.y).toBeCloseTo(next.y, 9);
  });
});

describe("random motion", () => {
  const cart = object({
    collision: "none",
    motion: {
      ...STATIC,
      algorithm: "wander",
      distance: 400,
      pause: 0.2,
      speed: 100,
      variance: 0.5,
    },
    origin: { x: 300, y: 200 },
  });
  const layout = zone(area([cart]));
  const pathOf = (attempt: number, seed = SEED) => {
    let state = enterArea(BIRD, layout, layout.start, {
      attempt,
      restarts: attempt,
      seed,
      steps: 0,
    });
    const xs: number[] = [];
    for (let step = 0; step < 600; step++) {
      state = stepZone(BIRD, layout, STEP, STILL, state);
      xs.push(state.objects[0]?.x ?? 0);
    }
    return xs;
  };
  it.each([
    ["the same seed and attempt", 0, SEED, true],
    ["the next attempt", 1, SEED, false],
    ["another seed", 0, SEED + 100, false],
  ])("on %s, repeats the first attempt's path: %s", (_, attempt, seed, same) => {
    expect(JSON.stringify(pathOf(attempt, seed)) === JSON.stringify(pathOf(0))).toBe(same);
  });
});
