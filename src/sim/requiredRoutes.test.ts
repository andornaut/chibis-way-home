import { createHash } from "node:crypto";

import { expect, it, vi } from "vitest";

import { BIRD_FRAME } from "../assets";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { Instance, TerrainRect, TilePoint, ZonePlan } from "../data/types";
import { SKILL_PROFILES } from "../progress";
import { zoneLayout } from "../rules/tiles";
import { startZone, stepZone, type ZoneInput } from "../rules/zone";
import { CATALOGUE } from "../testing/walkSuite";
import { type WalkStep, walkTransitions as memoizeTransitions } from "./walkTransitions";
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

it.each<{ cleared: boolean; name: string; solids: TerrainRect[]; target: TilePoint }>([
  {
    cleared: false,
    name: "an isolated far exit bank that is not a connected route",
    solids: [
      { ...floor, cols: 10 },
      { ...floor, col: 40, cols: 20 },
    ],
    target: { col: 45, row: 50 },
  },
  {
    cleared: true,
    name: "an explicitly required surface that is unreachable despite a clear exit",
    solids: [floor, { ...ledge, row: 30 }],
    target: { col: 22, row: 30 },
  },
])("refuses success for $name", ({ cleared, solids, target }) => {
  const result = walkRequiredRoutes(
    BIRD,
    { targets: [{ area: "course", at: target }], tile: TILE },
    layoutOf(solids),
  );
  const required = surfaceAt(TILE, result.surfaces, "course", target)!;
  expect(result.cleared).toBe(cleared);
  expect(result.reached.has(required.key)).toBe(false);
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

it("preserves fresh grounded interval evidence and moving-state traces with cached transitions", async () => {
  async function run(cached: boolean) {
    vi.resetModules();
    const engine = await import("../rules/zone");
    const calls = vi.spyOn(engine, "stepZone");
    const trace = createHash("sha256");
    let transitions = 0;
    vi.doMock("./walkTransitions", () => ({
      walkTransitions: (step: WalkStep): WalkStep => {
        const advance = cached ? memoizeTransitions(step) : step;
        return (input, zone) => {
          const next = advance(input, zone);
          trace.update(JSON.stringify({ input, next }));
          transitions++;
          return next;
        };
      },
    }));
    try {
      const walker = await import("./zoneWalk");
      const layout = layoutOf(
        [floor, ledge],
        [
          {
            character: "test-mover",
            col: 32,
            overrides: { motion: { distance: 2, pause: 0, speed: 2, variance: 0.25 } },
            phase: 0.35,
            row: 46,
          },
        ],
      );
      const results = [
        { max: 24, min: 22 },
        { max: 22, min: 20 },
      ].map((xRange) =>
        walker.walkRequiredRoutes(
          BIRD,
          {
            targets: [{ area: "course", at: { col: 22, row: 45 }, xRange }],
            tile: TILE,
          },
          layout,
        ),
      );
      return { calls: calls.mock.calls.length, results, trace: trace.digest("hex"), transitions };
    } finally {
      calls.mockRestore();
      vi.doUnmock("./walkTransitions");
    }
  }
  const original = await run(false);
  const cached = await run(true);
  expect(cached.results.every(({ complete }) => complete)).toBe(true);
  expect(cached.results).toEqual(original.results);
  expect(cached.transitions).toBe(original.transitions);
  expect(cached.trace).toBe(original.trace);
  expect(cached.calls).toBeLessThan(original.calls);
});

it("records an alive airborne engine exit before landing without inventing required witnesses", () => {
  const base = layoutOf([
    { col: 0, cols: 8, row: 40, rows: 20 },
    { col: 20, cols: 10, row: 50, rows: 10 },
  ]);
  const layout = {
    ...base,
    areas: {
      course: {
        ...base.areas.course!,
        entries: { start: { x: 4 * TILE, y: 40 * TILE } },
        exitX: 10 * TILE,
        width: 30 * TILE,
      },
    },
  };
  let actual = startZone(BIRD, layout, 1);
  for (let tick = 0; tick < 120 && !actual.cleared && !actual.death; tick++) {
    actual = stepZone(
      SKILL_PROFILES,
      BIRD,
      layout,
      1 / 60,
      { jumpHeld: false, move: 1, useHeld: false },
      actual,
    );
  }
  expect(actual.cleared).toBe(true);
  expect(actual.death).toBeUndefined();
  expect(actual.bird.grounded).toBe(false);

  const direct = walkRequiredRoutes(BIRD, { targets: [], tile: TILE }, layout);
  expect(direct.cleared).toBe(true);
  expect(direct.complete).toBe(true);
  expect(walkZone(BIRD, layout).cleared).toBe(true);

  for (const xRange of [undefined, { max: 24, min: 22 }]) {
    const required = walkRequiredRoutes(
      BIRD,
      {
        targets: [{ area: "course", at: { col: 24, row: 50 }, ...(xRange ? { xRange } : {}) }],
        tile: TILE,
      },
      layout,
    );
    const bank = surfaceAt(TILE, required.surfaces, "course", { col: 24, row: 50 })!;
    expect(required.cleared).toBe(true);
    expect(required.reached.has(bank.key)).toBe(false);
    expect(required.complete).toBe(false);
  }
});

it("keeps full-input branches, state identities and throwing transitions isolated", () => {
  const state = startZone(BIRD, layoutOf([floor]), 1);
  const still: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };
  const inputs: ZoneInput[] = [
    still,
    { ...still, jumpHeld: true },
    { ...still, move: 1 },
    { ...still, dashPressed: true },
    { ...still, push: { x: 1, y: 0 } },
    { ...still, push: { x: 0, y: 1 } },
  ];
  let refused = true;
  const step = vi.fn<WalkStep>((input, zone) => {
    if (input.useHeld && refused) {
      throw new Error("refused transition");
    }
    return { ...zone, seconds: zone.seconds + 1 };
  });
  const advance = memoizeTransitions(step);
  const results = inputs.map((input) => advance(input, state));
  expect(new Set(results).size).toBe(inputs.length);
  inputs.forEach((input, index) => expect(advance({ ...input }, state)).toBe(results[index]));
  expect(step.mock.calls).toEqual(inputs.map((input) => [input, state]));
  const use = { ...still, useHeld: true };
  expect(() => advance(use, state)).toThrow("refused transition");
  refused = false;
  const accepted = advance(use, state);
  expect(advance(use, state)).toBe(accepted);
  expect(step).toHaveBeenCalledTimes(inputs.length + 2);
  expect(advance(still, { ...state })).not.toBe(results[0]);
  expect(memoizeTransitions(step)(still, state)).not.toBe(results[0]);
  expect(step).toHaveBeenCalledTimes(inputs.length + 4);
});
