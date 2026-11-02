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
