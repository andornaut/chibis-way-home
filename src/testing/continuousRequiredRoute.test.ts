import { expect, it, vi } from "vitest";

import { BIRD_FRAME } from "../assets/index.ts";
import { TILE } from "../data/screen.ts";
import type { Instance, TerrainRect, ZonePlan } from "../data/types/index.ts";
import { zoneLayout } from "../rules/tiles.ts";
import * as zoneRules from "../rules/zone.ts";
import { startZone } from "../rules/zone.ts";
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
});

it("never counts the initialization snapshot as an actual-step witness", () => {
  const layout = fixture();
  const initial = startZone(ORDINARY, layout, 1);
  const entry = { ...initial, bird: { ...initial.bird, grounded: true } };
  const col = entry.bird.x / TILE;
  const target = { area: entry.area, at: { col, row: 50 }, xRange: { max: col, min: col } };
  const initialize = vi.spyOn(zoneRules, "startZone").mockReturnValueOnce(entry);
  try {
    const result = continuousRequiredRoute(layout, [target]);
    expect(result.terminal.cleared).toBe(true);
    expect(result.status).toBe("not-proven");
    expect(result.missing).toEqual([{ index: 0, target }]);
    expect(result.witnesses).toEqual([]);
  } finally {
    initialize.mockRestore();
  }
});

it("rejects an actual clear that misses a declared refuge surface", () => {
  const target = { area: "course", at: { col: 20, row: 30 } };
  const result = continuousRequiredRoute(fixture([floor, { col: 20, cols: 4, row: 30, rows: 1 }]), [
    target,
  ]);
  expect(result.terminal.cleared).toBe(true);
  expect(result.status).toBe("not-proven");
  expect(result.reason).toBe("missing-targets");
  expect(result.missing).toEqual([{ index: 0, target }]);
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
});
