import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { Instance, TerrainRect, ZonePlan } from "../data/types";
import { zoneLayout } from "../rules/tiles";
import { CATALOGUE } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";
import { surfaceAt, walkRequiredRoutes, walkZone } from "./zoneWalk";

const floor: TerrainRect = { col: 0, cols: 60, row: 50, rows: 10 };
const ledge: TerrainRect = { col: 20, cols: 6, row: 45, rows: 1 };
function layoutOf(solids: readonly TerrainRect[], objects: readonly Instance[] = []) {
  const plan: ZonePlan = {
    areas: {
      course: { cols: 60, entries: { start: { col: 4, row: 50 } }, objects, rows: 60, solids },
    },
    start: { area: "course", entry: "start" },
  };
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, {}, {}, new Set(), plan);
}

it("stops after an actual exit proof while exhaustive diagnostics still reach optional ledges", () => {
  const layout = layoutOf([floor, ledge]);
  const required = walkRequiredRoutes(BIRD, { targets: [], tile: TILE }, layout);
  const exhaustive = walkZone(BIRD, layout);
  const optional = surfaceAt(TILE, exhaustive.surfaces, "course", { col: 22, row: 45 })!;
  expect(required.complete).toBe(true);
  expect(required.cleared).toBe(true);
  expect(required.reached.has(optional.key)).toBe(false);
  expect(exhaustive.cleared).toBe(true);
  expect(exhaustive.reached.has(optional.key)).toBe(true);
  expect(required.steps).toBeLessThan(exhaustive.steps);
});

it.each([
  {
    expectedMover: undefined,
    name: "a stationary refuge",
    objects: [],
    solids: [floor, ledge],
    target: { col: 22, row: 45 },
  },
  {
    expectedMover: 0,
    name: "an actually boarded moving platform",
    objects: [
      {
        character: "test-mover",
        col: 20,
        overrides: { motion: { distance: 2, pause: 0, speed: 2, variance: 0 } },
        row: 46,
      },
    ],
    solids: [floor],
    target: { col: 22, row: 46 },
  },
])(
  "continues beyond exit clearance until reaching $name",
  ({ expectedMover, objects, solids, target }) => {
    const layout = layoutOf(solids, objects);
    const result = walkRequiredRoutes(
      BIRD,
      { targets: [{ area: "course", at: target }], tile: TILE },
      layout,
    );
    const surface = surfaceAt(TILE, result.surfaces, "course", target)!;
    expect(surface.mover).toBe(expectedMover);
    expect(result.reached.has(surface.key)).toBe(true);
    expect(result.complete).toBe(true);
  },
);

it("does not count an isolated far exit bank as a connected route", () => {
  const layout = layoutOf([
    { ...floor, cols: 10 },
    { ...floor, col: 40, cols: 20 },
  ]);
  const result = walkRequiredRoutes(
    BIRD,
    { targets: [{ area: "course", at: { col: 45, row: 50 } }], tile: TILE },
    layout,
  );
  const far = surfaceAt(TILE, result.surfaces, "course", { col: 45, row: 50 })!;
  expect(result.cleared).toBe(false);
  expect(result.reached.has(far.key)).toBe(false);
  expect(result.complete).toBe(false);
});

it("refuses success when an explicitly required surface is unreachable despite a clear exit", () => {
  const layout = layoutOf([floor, { ...ledge, row: 30 }]);
  const result = walkRequiredRoutes(
    BIRD,
    { targets: [{ area: "course", at: { col: 22, row: 30 } }], tile: TILE },
    layout,
  );
  expect(result.cleared).toBe(true);
  expect(result.complete).toBe(false);
});

it("rejects a missing required surface instead of silently dropping it", () => {
  expect(() =>
    walkRequiredRoutes(
      BIRD,
      { targets: [{ area: "course", at: { col: 22, row: 30 } }], tile: TILE },
      layoutOf([floor]),
    ),
  ).toThrow("No required route surface");
});

it.each([
  { complete: false, exitX: 5 * TILE, name: "an exit before the shelter interval" },
  {
    complete: true,
    exitX: 17 * TILE,
    name: "an actual grounded walk through the shelter interval",
  },
])(
  "requires interval evidence rather than surface-ever-reached for $name",
  ({ complete, exitX }) => {
    const base = layoutOf([
      { ...floor, cols: 18 },
      { col: 6, cols: 6, row: 44, rows: 1 },
    ]);
    const layout = {
      ...base,
      areas: { course: { ...base.areas.course!, exitX, width: 18 * TILE } },
    };
    const result = walkRequiredRoutes(
      BIRD,
      {
        targets: [{ area: "course", at: { col: 2, row: 50 }, xRange: { max: 10, min: 6 } }],
        tile: TILE,
      },
      layout,
    );
    const surface = surfaceAt(TILE, result.surfaces, "course", { col: 2, row: 50 })!;
    expect(result.reached.has(surface.key)).toBe(true);
    expect(result.cleared).toBe(true);
    expect(result.complete).toBe(complete);
  },
);

it("deliberately visits a required interval within an already seen single bucket", () => {
  const base = layoutOf([{ ...floor, cols: 7 }]);
  const layout = {
    ...base,
    areas: {
      course: {
        ...base.areas.course!,
        entries: { start: { x: 5 * TILE, y: 50 * TILE } },
        exitX: 6 * TILE,
        width: 7 * TILE,
      },
    },
  };
  const direct = walkRequiredRoutes(BIRD, { targets: [], tile: TILE }, layout);
  const required = walkRequiredRoutes(
    BIRD,
    {
      targets: [{ area: "course", at: { col: 2, row: 50 }, xRange: { max: 2, min: 1 } }],
      tile: TILE,
    },
    layout,
  );
  expect(direct.complete).toBe(true);
  expect(required.complete).toBe(true);
  expect(required.steps).toBeGreaterThan(direct.steps);
});

it.each([
  { max: 10, min: Infinity },
  { max: 6, min: 10 },
  { max: 10, min: -1 },
  { max: 60, min: 6 },
])("rejects invalid body intervals without widening them: %j", (xRange) => {
  expect(() =>
    walkRequiredRoutes(
      BIRD,
      { targets: [{ area: "course", at: { col: 2, row: 50 }, xRange }], tile: TILE },
      layoutOf([floor]),
    ),
  ).toThrow("Invalid required route xRange");
});
