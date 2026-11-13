import { expect, it, vi } from "vitest";

import { BIRD_FRAME } from "../assets/index.ts";
import { EDGE } from "../core/index.ts";
import { TILE } from "../data/screen.ts";
import type { Instance, TerrainRect, ZonePlan } from "../data/types/index.ts";
import { zoneLayout } from "../rules/tiles.ts";
import * as zoneRules from "../rules/zone.ts";
import { startZone } from "../rules/zone.ts";
import { botInput, DIAGNOSTIC_SKILL, newBot, prepareSensors } from "../sim/bot.ts";
import {
  requiredRouteObservation,
  requiredRouteTargetReached,
  surfaceAt,
  type WalkRouteTarget,
  zoneSurfaces,
} from "../sim/zoneWalk.ts";
import { CATALOGUE } from "./art.ts";
import { continuousRequiredRoute } from "./continuousRequiredRoute.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import { REQUIRED_ROUTE_CONTROLLER, requiredRouteIntent } from "./requiredRouteIntent.ts";

const floor: TerrainRect = { col: 0, cols: 60, row: 50, rows: 10 };
function fixture(
  solids: readonly TerrainRect[] = [floor],
  objects: readonly Instance[] = [],
  cols = 60,
) {
  const plan: ZonePlan = {
    areas: { course: { cols, entries: { start: { col: 4, row: 50 } }, objects, rows: 60, solids } },
    start: { area: "course", entry: "start" },
  };
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, {}, {}, new Set(), plan);
}

it("proves an actual continuous ordinary entry-to-clear trajectory with grounded witnesses", () => {
  const result = continuousRequiredRoute(fixture(), [{ area: "course", at: { col: 58, row: 50 } }]);
  expect(result.status).toBe("proven");
  expect(result.terminal.cleared).toBe(true);
  expect(result.ticks).toBeGreaterThan(0);
  expect(result.ticks).toBeLessThanOrEqual(600);
  expect(result.missing).toEqual([]);
  expect(result.witnesses).toHaveLength(1);
  expect(result.witnesses.every(({ tick }) => tick >= 1)).toBe(true);
  expect(result.controller).toBe(REQUIRED_ROUTE_CONTROLLER);
});

it("never counts the initialization snapshot as an actual-step witness", () => {
  const layout = fixture();
  const initial = startZone(ORDINARY, layout, 1);
  const entry = { ...initial, bird: { ...initial.bird, grounded: true } };
  const col = entry.bird.x / TILE;
  const target = { area: entry.area, at: { col, row: 50 }, xRange: { max: col, min: col } };
  const initialize = vi
    .spyOn(zoneRules, "startZone")
    .mockReturnValueOnce({ ...entry, cleared: true });
  try {
    const result = continuousRequiredRoute(layout, [target]);
    expect(result.terminal.cleared).toBe(true);
    expect(result.status).toBe("not-proven");
    expect(result.missing).toEqual([{ index: 0, target }]);
    expect(result.witnesses).toEqual([]);
    expect(result.ticks).toBe(0);
  } finally {
    initialize.mockRestore();
  }
});

it("leaves a declared refuge unresolved when its approach becomes unavailable", () => {
  const target = { area: "course", at: { col: 20, row: 30 } };
  const result = continuousRequiredRoute(fixture([floor, { col: 20, cols: 4, row: 30, rows: 1 }]), [
    target,
  ]);
  expect(result.status).toBe("not-proven");
  expect(result.reason).toBe("intent-unavailable");
  expect(result.missing).toEqual([{ index: 0, target }]);
  expect(result.unavailable).toMatchObject({ index: 0 });
});

it("records an initialized grounded refuge only after its first actual step", () => {
  const layout = fixture();
  const initial = startZone(ORDINARY, layout, 1);
  const entry = { ...initial, bird: { ...initial.bird, grounded: true } };
  const col = entry.bird.x / TILE;
  const target = { area: entry.area, at: { col, row: 50 }, xRange: { max: col, min: col } };
  const initialize = vi.spyOn(zoneRules, "startZone").mockReturnValueOnce(entry);
  try {
    const result = continuousRequiredRoute(layout, [target]);
    expect(result.status).toBe("proven");
    expect(result.witnesses).toEqual([
      { area: entry.area, index: 0, tick: 1, x: entry.bird.x, y: entry.bird.y },
    ]);
  } finally {
    initialize.mockRestore();
  }
});

it("lands and approaches separate exact windows before continuing to clear", () => {
  const targets = [
    { area: "course", at: { col: 58, row: 50 } },
    { area: "course", at: { col: 14, row: 50 }, xRange: { max: 14, min: 14 } },
    { area: "course", at: { col: 12, row: 50 }, xRange: { max: 12, min: 12 } },
  ];
  const result = continuousRequiredRoute(fixture(), targets);
  expect(result, JSON.stringify(result)).toMatchObject({
    missing: [],
    reason: "cleared",
    status: "proven",
    unavailable: undefined,
  });
  const first = result.witnesses.find(({ index }) => index === 2)!;
  const second = result.witnesses.find(({ index }) => index === 1)!;
  expect(Math.abs(first.x - 12 * TILE)).toBeLessThanOrEqual(EDGE);
  expect(Math.abs(second.x - 14 * TILE)).toBeLessThanOrEqual(EDGE);
  expect(first.y).toBe(50 * TILE - ORDINARY.height);
  expect(second.y).toBe(50 * TILE - ORDINARY.height);
  expect(first.tick).toBeGreaterThanOrEqual(1);
  expect(second.tick).toBeGreaterThan(first.tick);
  expect(result.ticks).toBeLessThanOrEqual(600);
});

it("holds horizontal position above an exact refuge until an actual grounded landing", () => {
  const base = fixture();
  const area = base.areas.course!;
  const layout = {
    ...base,
    areas: {
      course: { ...area, entries: { start: { ...area.entries.start!, y: 40 * TILE } } },
    },
  };
  const result = continuousRequiredRoute(layout, [
    { area: "course", at: { col: 4, row: 50 }, xRange: { max: 4, min: 4 } },
  ]);
  expect(result).toMatchObject({ missing: [], reason: "cleared", status: "proven" });
  expect(result.witnesses).toHaveLength(1);
  const witness = result.witnesses[0]!;
  expect(Math.abs(witness.x - 4 * TILE)).toBeLessThanOrEqual(EDGE);
  expect(witness.y).toBe(50 * TILE - ORDINARY.height);
  expect(witness.tick).toBeGreaterThan(1);
  expect(result.ticks).toBeLessThanOrEqual(600);
});

it("records a lower static-bank landing separately while keeping the required goal locked", () => {
  const layout = fixture([
    { col: 0, cols: 8, row: 50, rows: 10 },
    { col: 10, cols: 6, row: 54, rows: 6 },
    { col: 18, cols: 42, row: 50, rows: 10 },
  ]);
  const targets = [
    { area: "course", at: { col: 58, row: 50 } },
    { area: "course", at: { col: 4, row: 50 } },
  ];
  const original = structuredClone(targets);
  const result = continuousRequiredRoute(layout, targets);
  expect(result, JSON.stringify(result)).toMatchObject({
    missing: [],
    reason: "cleared",
    status: "proven",
  });
  expect(targets).toEqual(original);
  expect(result.witnesses).toHaveLength(targets.length);
  expect(result.assistWitnesses).toHaveLength(1);
  const assist = result.assistWitnesses[0]!;
  expect(assist).toMatchObject({
    area: "course",
    requiredIndex: 0,
    y: 54 * TILE - ORDINARY.height,
  });
  expect(assist.tick).toBeGreaterThanOrEqual(1);
  expect(assist.tick).toBeLessThan(result.witnesses.find(({ index }) => index === 0)!.tick);
  expect(result.ticks).toBeLessThanOrEqual(600);
});

it("keeps a missed exact window unresolved instead of skipping to the next target", () => {
  const target = { area: "course", at: { col: 1, row: 50 }, xRange: { max: 1, min: 1 } };
  const result = continuousRequiredRoute(fixture(), [target]);
  expect(result).toMatchObject({
    reason: "intent-unavailable",
    status: "not-proven",
    ticks: 0,
    unavailable: { index: 0, reason: "target-behind" },
  });
  expect(result.missing).toEqual([{ index: 0, target }]);
  expect(result.witnesses).toEqual([]);
});

it("does not cancel native committed holding or its observed-height release", () => {
  const layout = fixture();
  const zone = startZone(ORDINARY, layout, 1);
  const surfaces = zoneSurfaces(ORDINARY, layout);
  const surface = surfaces[0]!;
  const grounded = { ...zone, bird: { ...zone.bird, grounded: true } };
  const intent = requiredRouteIntent(
    ORDINARY,
    { area: zone.area, bird: grounded.bird, support: surface },
    { index: 0, surface, window: { max: grounded.bird.x, min: grounded.bird.x } },
  );
  expect(intent).toEqual({ inhibitNewJump: true, move: 0 });
  if ("unavailable" in intent) {
    throw new Error("Expected a grounded route intent");
  }
  const policy = {
    jump: intent.inhibitNewJump ? ("never" as const) : ("reactive" as const),
    move: intent.move,
  };
  const bot = newBot(1);
  bot.holding = 2;
  const sensors = prepareSensors(layout);
  expect(botInput(ORDINARY, sensors, layout, DIAGNOSTIC_SKILL, policy, grounded, bot)).toEqual({
    jumpHeld: true,
    move: 0,
    useHeld: false,
  });
  expect(bot.holding).toBe(1);
  bot.targetY = grounded.bird.y + ORDINARY.height;
  expect(botInput(ORDINARY, sensors, layout, DIAGNOSTIC_SKILL, policy, grounded, bot)).toEqual({
    jumpHeld: false,
    move: 0,
    useHeld: false,
  });
  expect(bot.holding).toBe(0);
});

it("stops at exactly 600 actual steps without clearing a longer course", () => {
  const result = continuousRequiredRoute(fixture([{ ...floor, cols: 500 }], [], 500), []);
  expect(result).toMatchObject({ reason: "budget-exhausted", status: "not-proven", ticks: 600 });
  expect(result.terminal.cleared).toBe(false);
});

it("matches an exact refuge interval using body-left X and rejects unsafe observations", () => {
  const layout = fixture();
  const query = { surfaces: zoneSurfaces(ORDINARY, layout), tile: TILE };
  const target: WalkRouteTarget = {
    area: "course",
    at: { col: 12, row: 50 },
    xRange: { max: 12, min: 12 },
  };
  const start = startZone(ORDINARY, layout, 1);
  const zone = {
    ...start,
    bird: { ...start.bird, grounded: true, x: 12 * TILE, y: 50 * TILE - ORDINARY.height },
  };
  const expected = surfaceAt(TILE, query.surfaces, target.area, target.at);
  const interval = { max: target.xRange!.max * TILE, min: target.xRange!.min * TILE };
  const match = (state: typeof zone) =>
    requiredRouteTargetReached(
      expected,
      interval,
      requiredRouteObservation(ORDINARY, layout, query.surfaces, state),
    );
  expect(match(zone)).toBe(true);
  expect(match({ ...zone, bird: { ...zone.bird, x: zone.bird.x + 0.01 } })).toBe(false);
  expect(match({ ...zone, bird: { ...zone.bird, x: zone.bird.x - ORDINARY.width / 2 } })).toBe(
    false,
  );
  expect(match({ ...zone, bird: { ...zone.bird, grounded: false } })).toBe(false);
  expect(match({ ...zone, turnedBack: true })).toBe(false);
  expect(match({ ...zone, area: "other" })).toBe(false);
  expect(
    match({
      ...zone,
      death: {
        position: { x: zone.bird.x, y: zone.bird.y },
        reason: "fall",
        support: undefined,
        velocity: { x: 0, y: 0 },
      },
    }),
  ).toBe(false);
});

it("matches a moving refuge at its current support position and keeps full-body support", () => {
  const layout = fixture(
    [floor],
    [
      {
        character: "test-mover",
        col: 20,
        overrides: { motion: { distance: 12, pause: 0, speed: 2, variance: 0 } },
        row: 45,
      },
    ],
  );
  const surfaces = zoneSurfaces(ORDINARY, layout);
  const target: WalkRouteTarget = {
    area: "course",
    at: { col: 21, row: 45 },
    xRange: { max: 30, min: 30 },
  };
  const start = startZone(ORDINARY, layout, 1);
  const zone = {
    ...start,
    bird: { ...start.bird, grounded: true, x: 30 * TILE, y: 45 * TILE - ORDINARY.height },
    objects: start.objects.map((object, index) =>
      index === 0 ? { ...object, x: 30 * TILE } : object,
    ),
  };
  const expected = surfaceAt(TILE, surfaces, target.area, target.at);
  const interval = { max: target.xRange!.max * TILE, min: target.xRange!.min * TILE };
  expect(
    requiredRouteTargetReached(
      expected,
      interval,
      requiredRouteObservation(ORDINARY, layout, surfaces, zone),
    ),
  ).toBe(true);
  const offSupport = {
    ...zone,
    objects: zone.objects.map((object, index) =>
      index === 0 ? { ...object, x: zone.bird.x + 1 } : object,
    ),
  };
  expect(
    requiredRouteTargetReached(
      expected,
      interval,
      requiredRouteObservation(ORDINARY, layout, surfaces, offSupport),
    ),
  ).toBe(false);
  expect(
    requiredRouteTargetReached(
      expected,
      undefined,
      requiredRouteObservation(ORDINARY, layout, surfaces, offSupport),
    ),
  ).toBe(true);
  expect(continuousRequiredRoute(layout, [target])).toMatchObject({
    reason: "intent-unavailable",
    status: "not-proven",
    unavailable: { index: 0, reason: "dynamic-support" },
    witnesses: [],
  });
});
