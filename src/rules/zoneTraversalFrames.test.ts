import { expect, it, vi } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BEHAVIOUR_TRAVERSAL_SEARCH } from "../data/behaviours";
import { BIRD } from "../data/bird";
import type { AreaLayout, BehaviourPlan, ObjectLayout, ZoneLayout } from "../data/types";
import { advanceBehaviour } from "./behaviour";
import { startZone, stepZone } from "./zone";

vi.mock("./behaviour", async (original) => {
  const actual = await original<typeof import("./behaviour")>();
  return { ...actual, advanceBehaviour: vi.fn(actual.advanceBehaviour) };
});

function object(
  behaviour: BehaviourPlan,
  collision: ObjectLayout["collision"],
  x: number,
  y: number,
): ObjectLayout {
  return {
    animations: {
      idle: undefined,
      move: undefined,
      open: undefined,
      react: undefined,
      talk: undefined,
    },
    art: "fixture",
    behaviour,
    character: "fixture",
    collision,
    height: 24,
    hitbox: undefined,
    interaction: { kind: "none", range: 0 },
    lines: [],
    motion: {
      algorithm: "static",
      direction: "right",
      distance: 0,
      hopHeight: 0,
      pause: 0,
      speed: 0,
      variance: 0,
    },
    origin: { x, y },
    phase: 0,
    quips: [],
    quirks: [],
    reaction: { kind: "none", range: 0, speed: 0 },
    room: undefined,
    scene: undefined,
    width: 48,
  };
}

it("supplies actual traversal context to flying pursuit for idle recovery", () => {
  vi.mocked(advanceBehaviour).mockClear();
  const actor = object(
    {
      axis: "x",
      distance: 120,
      initial: "chase",
      pursuit: {
        distance: 1000,
        escaped: { line: "escaped", speaker: "fixture" },
        unreachableGraceSeconds: null,
      },
      states: {
        chase: {
          animation: null,
          motion: { kind: "pursue", mode: "fly", speed: 60 },
          transitions: [],
        },
      },
    },
    "hazard",
    400,
    180,
  );
  const floor = { height: 60, width: 1100, x: 0, y: 300 };
  const layout: ZoneLayout = {
    areas: {
      main: {
        backX: 12,
        chunks: [],
        entries: { start: { x: 100, y: 300 } },
        exitX: 1088,
        height: 360,
        objects: [actor],
        solids: [floor],
        terrain: [],
        tileset: undefined,
        width: 1100,
      },
    },
    birdFrame: BIRD_FRAME,
    start: { area: "main", entry: "start" },
  };
  stepZone(
    BIRD,
    layout,
    STEP_SECONDS,
    { jumpHeld: false, move: 0, useHeld: false },
    startZone(BIRD, layout, 1),
  );
  const world = vi.mocked(advanceBehaviour).mock.calls.find(([, owner]) => owner === actor)![0]
    .world;
  expect(world.solids).toContain(floor);
  expect(world.hazards?.[0]?.owner).toBe(actor);
  expect(world.hazards?.[0]?.boundsAt).toBeTypeOf("function");
  expect(world.hazards?.[0]?.boundsAt?.(STEP_SECONDS)).toBeUndefined();
  expect(world.traversalFrame).toMatchObject({
    bounds: { height: 360, width: 1100, x: 0, y: 0 },
    dtSeconds: STEP_SECONDS,
    platforms: [],
    timeSeconds: 0,
  });
});

it.each([
  { reversed: false, turning: false },
  { reversed: true, turning: false },
  { reversed: false, turning: true },
  { reversed: true, turning: true },
])(
  "shares exact support samples across queries, reversed=$reversed, turning=$turning",
  ({ reversed, turning }) => {
    vi.mocked(advanceBehaviour).mockClear();
    const mover = object(
      {
        axis: "x",
        distance: turning ? 2 : 120,
        initial: "travel",
        states: {
          pause: {
            animation: null,
            motion: { kind: "wait" },
            transitions: [{ to: "return", when: [{ kind: "elapsed", seconds: STEP_SECONDS * 2 }] }],
          },
          return: {
            animation: null,
            motion: { direction: -1, kind: "move", speed: 120 },
            transitions: [{ to: "travel", when: [{ kind: "boundary" }] }],
          },
          travel: {
            animation: null,
            motion: { direction: 1, kind: "move", speed: 120 },
            transitions: turning ? [{ to: "pause", when: [{ kind: "boundary" }] }] : [],
          },
        },
      },
      "ledge",
      250,
      180,
    );
    const actor = object(
      {
        axis: "x",
        distance: 120,
        initial: "chase",
        pursuit: {
          distance: 1000,
          escaped: { line: "escaped", speaker: "fixture" },
          unreachableGraceSeconds: 3,
        },
        states: {
          chase: {
            animation: null,
            motion: {
              kind: "pursue",
              mode: "ground",
              speed: 60,
              traversal: { gravity: 1000, jumpSpeed: 300, maxFallSpeed: 500, prepSeconds: 0 },
            },
            transitions: [],
          },
        },
      },
      "hazard",
      400,
      276,
    );
    const area: AreaLayout = {
      backX: 12,
      chunks: [],
      entries: { start: { x: 100, y: 300 } },
      exitX: 1088,
      height: 360,
      objects: reversed ? [mover, actor] : [actor, mover],
      solids: [{ height: 60, width: 1100, x: 0, y: 300 }],
      terrain: [],
      tileset: undefined,
      width: 1100,
    };
    const layout: ZoneLayout = {
      areas: { main: area },
      birdFrame: BIRD_FRAME,
      start: { area: "main", entry: "start" },
    };
    const zone = { ...startZone(BIRD, layout, 1), seconds: 2 };
    stepZone(BIRD, layout, STEP_SECONDS, { jumpHeld: false, move: 0, useHeld: false }, zone);
    const calls = vi.mocked(advanceBehaviour).mock.calls;
    expect(calls.filter(([, owner]) => owner === mover)).toHaveLength(1);
    const actorWorld = calls.find(([, owner]) => owner === actor)![0].world;
    const moverWorld = calls.find(([, owner]) => owner === mover)![0].world;
    expect(moverWorld.traversalFrame).toBeUndefined();
    const frame = actorWorld.traversalFrame!;
    expect(frame).toMatchObject({ dtSeconds: STEP_SECONDS, timeSeconds: 2 });
    expect(frame.platforms).toHaveLength(1);
    const support = frame.platforms[0]!;
    expect(support.owner).toBe(mover);
    expect(support.before.x).toBe(250);
    expect(support.after.x).toBeCloseTo(251);
    expect(support.segments![0]).toMatchObject({ endSeconds: 2 + STEP_SECONDS, startSeconds: 2 });
    const from = support.segments![0]!.from;
    const descriptor = Object.getOwnPropertyDescriptor(from, "x")!;
    const reads = vi.fn(() => descriptor.value as number);
    Object.defineProperty(from, "x", { configurable: true, enumerable: true, get: reads });
    const start = zone.seconds + STEP_SECONDS / 4;
    const duration = STEP_SECONDS / 4;
    const clipped = frame.sample!(start, duration)!;
    const firstReads = reads.mock.calls.length;
    expect(firstReads).toBeGreaterThan(0);
    expect(frame.sample!(start, duration)).toBe(clipped);
    expect(reads).toHaveBeenCalledTimes(firstReads);
    expect(frame.sample!(start + STEP_SECONDS / 8, duration)).not.toBe(clipped);
    expect(frame.sample!(start, duration / 2)).not.toBe(clipped);
    expect(reads.mock.calls.length).toBeGreaterThan(firstReads);
    Object.defineProperty(from, "x", descriptor);
    expect(clipped[0]!.owner).toBe(mover);
    expect(clipped[0]!.segments![0]).toMatchObject({
      endSeconds: start + duration,
      startSeconds: start,
    });
    const budget = BEHAVIOUR_TRAVERSAL_SEARCH.budget;
    const horizon = Object.getOwnPropertyDescriptor(budget, "horizonSteps")!;
    const horizonReads = vi.fn(() => horizon.value as number);
    Object.defineProperty(budget, "horizonSteps", { configurable: true, get: horizonReads });
    try {
      const outside = zone.seconds + (horizon.value + 2) * STEP_SECONDS;
      expect(frame.sample!(outside, STEP_SECONDS)).toBeUndefined();
      expect(frame.sample!(outside, STEP_SECONDS)).toBeUndefined();
      expect(horizonReads).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(budget, "horizonSteps", horizon);
    }
    const predicted = frame.sample!(zone.seconds + STEP_SECONDS, STEP_SECONDS)![0]!;
    const input = { jumpHeld: false, move: 0, useHeld: false } as const;
    const stepped = stepZone(BIRD, layout, STEP_SECONDS, input, zone);
    const following = stepZone(BIRD, layout, STEP_SECONDS, input, stepped);
    const moverIndex = area.objects.indexOf(mover);
    expect(predicted.owner).toBe(mover);
    expect(predicted.before.x).toBeCloseTo(stepped.objects[moverIndex]!.x);
    expect(predicted.after.x).toBeCloseTo(following.objects[moverIndex]!.x);
    expect(predicted.before.y).toBeCloseTo(stepped.objects[moverIndex]!.y);
    expect(predicted.after.y).toBeCloseTo(following.objects[moverIndex]!.y);
    let actual = zone;
    for (let tick = 0; tick < 6; tick++) {
      const start = zone.seconds + tick * STEP_SECONDS;
      const sample = frame.sample!(start, STEP_SECONDS)!;
      expect(frame.sample!(start, STEP_SECONDS)).toBe(sample);
      const next = stepZone(BIRD, layout, STEP_SECONDS, input, actual);
      expect(sample[0]!.before.x).toBeCloseTo(actual.objects[moverIndex]!.x);
      expect(sample[0]!.after.x).toBeCloseTo(next.objects[moverIndex]!.x);
      actual = next;
    }
    const latest = vi
      .mocked(advanceBehaviour)
      .mock.calls.filter(([, owner]) => owner === actor)
      .at(-1)![0].world;
    const fresh = latest.traversalFrame!;
    expect(fresh.sample).not.toBe(frame.sample);
    expect(fresh.sample!(fresh.timeSeconds, STEP_SECONDS)).not.toBe(
      frame.sample!(fresh.timeSeconds, STEP_SECONDS),
    );
  },
);
