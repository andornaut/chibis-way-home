import { expect, it, vi } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import type { AreaLayout, BehaviourPlan, ObjectLayout, Rect, ZoneLayout } from "../data/types";
import { advanceBehaviour } from "./behaviour";
import { traversalContext } from "./behaviourTraversal";
import { crumblingDefinitions } from "./crumbling";
import { startZone, stepZone, type ZoneState } from "./zone";

vi.mock("./behaviour", async (original) => {
  const actual = await original<typeof import("./behaviour")>();
  return { ...actual, advanceBehaviour: vi.fn(actual.advanceBehaviour) };
});

const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const PROFILE = { absentSeconds: 0.05, warningSeconds: 0.05 };
const GROUND = {
  kind: "pursue",
  mode: "ground",
  speed: 60,
  traversal: { gravity: 1000, jumpSpeed: 300, maxFallSpeed: 500, prepSeconds: 0 },
} as const;

function object(
  behaviour: BehaviourPlan | undefined,
  collision: ObjectLayout["collision"],
  rect: Rect,
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
    ...(behaviour && { behaviour }),
    character: "fixture",
    collision,
    height: rect.height,
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
    origin: { x: rect.x, y: rect.y },
    phase: 0,
    quips: [],
    quirks: [],
    reaction: { kind: "none", range: 0, speed: 0 },
    room: undefined,
    scene: undefined,
    width: rect.width,
  };
}

function fixture(actorAt?: Rect) {
  const ledge = {
    ...object(undefined, "ledge", { height: 12, width: 72, x: 400, y: 200 }),
    crumbling: PROFILE,
  };
  const actor =
    actorAt &&
    object(
      {
        axis: "x",
        distance: 120,
        initial: "chase",
        pursuit: {
          distance: 1000,
          escaped: { line: "escaped", speaker: "fixture" },
          unreachableGraceSeconds: 3,
        },
        states: { chase: { animation: null, motion: GROUND, transitions: [] } },
      },
      "hazard",
      actorAt,
    );
  const base: AreaLayout = {
    backX: 12,
    chunks: [{ width: 1100, x: 0 }],
    entries: { start: { x: 100, y: 300 } },
    exitX: 1088,
    height: 360,
    objects: actor ? [ledge, actor] : [ledge],
    solids: [{ height: 60, width: 1100, x: 0, y: 300 }],
    terrain: [],
    tileset: undefined,
    width: 1100,
  };
  const area = { ...base, crumbling: crumblingDefinitions(base) };
  const layout: ZoneLayout = {
    areas: { main: area },
    birdFrame: BIRD_FRAME,
    start: { area: "main", entry: "start" },
  };
  return { actor, area, layout, ledge };
}

const phase = (zone: ZoneState) => zone.crumbling!.supports[0]!.phase;

it("a boss standing on a crumbling support does not start its warning", () => {
  const f = fixture({ height: 24, width: 48, x: 412, y: 176 });
  let zone = startZone(BIRD, f.layout, 1);
  zone = stepZone(BIRD, f.layout, STEP_SECONDS, idle, zone);
  expect(zone.behaviours[1]!.traversal!.physical).toMatchObject({
    grounded: true,
    supportId: f.ledge,
  });
  expect(zone.crumbling!.pendingContacts).toEqual([]);
  zone = stepZone(BIRD, f.layout, STEP_SECONDS, idle, zone);
  expect(phase(zone)).toEqual({ kind: "intact" });
});

it("boss predictions keep current presence only until each support's earliest change", () => {
  const f = fixture({ height: 24, width: 48, x: 412, y: 176 });
  vi.mocked(advanceBehaviour).mockClear();
  const known = STEP_SECONDS + PROFILE.warningSeconds;
  // The warning Chibi started under the boss.
  const start = startZone(BIRD, f.layout, 1);
  const warned: ZoneState = {
    ...start,
    crumbling: {
      ...start.crumbling!,
      supports: [{ phase: { kind: "warning", removeAtSeconds: known }, supportId: f.ledge }],
    },
  };
  const zone = stepZone(BIRD, f.layout, STEP_SECONDS, idle, warned);
  const world = vi.mocked(advanceBehaviour).mock.calls.find(([, owner]) => owner === f.actor)![0]
    .world;
  const frame = world.traversalFrame!;
  expect(frame.crumbling!.unknown(0)).toEqual([]);
  expect(frame.crumbling!.unknown(known - STEP_SECONDS)).toEqual([]);
  expect(frame.crumbling!.unknown(known)).toEqual([f.area.crumbling![0]!.volume]);
  const context = traversalContext(world, STEP_SECONDS, f.actor!, GROUND)!;
  const near = { height: 40, width: 100, x: 390, y: 180 };
  const far = { height: 40, width: 100, x: 800, y: 280 };
  expect(context.sampleColliders(0, STEP_SECONDS, near).complete).toBe(true);
  expect(context.sampleColliders(known, STEP_SECONDS, near).complete).toBe(false);
  expect(context.sampleColliders(known, STEP_SECONDS, far).complete).toBe(true);
  expect(zone.crumbling!.pendingContacts).toEqual([]);
});

it("an absent support waits for every physical body to leave its volume before restoring", () => {
  const f = fixture();
  const start = startZone(BIRD, f.layout, 1);
  const overdue: ZoneState = {
    ...start,
    // Chibi's body overlaps the restoration volume at the deadline boundary.
    bird: { ...start.bird, grounded: false, vy: 0, x: 420, y: 180 },
    crumbling: {
      ...start.crumbling!,
      begunAtSeconds: 0,
      supports: [{ phase: { kind: "absent", restoreAfterSeconds: 0.5 }, supportId: f.ledge }],
    },
    seconds: 0.5,
  };
  const occupied = stepZone(BIRD, f.layout, STEP_SECONDS, idle, overdue);
  expect(phase(occupied)).toEqual({ kind: "absent", restoreAfterSeconds: 0.5 });
  // The absent ledge does not catch her; she falls through its volume.
  expect(occupied.bird.y).toBeGreaterThan(overdue.bird.y);
  const clear = stepZone(BIRD, f.layout, STEP_SECONDS, idle, {
    ...occupied,
    bird: { ...occupied.bird, y: 260 },
  });
  expect(phase(clear)).toEqual({ kind: "intact" });
  expect(clear.crumbling!.pendingContacts).toEqual([]);
});
