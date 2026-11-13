import { expect, it } from "vitest";

import { BIRD_FRAME } from "../assets/index.ts";
import { EDGE, STEP_SECONDS } from "../core/index.ts";
import { WARNED_VENT_SECONDS } from "../data/obstacleBehaviours.ts";
import { TILE } from "../data/screen.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { startBird } from "../rules/bird.ts";
import { zoneLayout } from "../rules/tiles.ts";
import { startZone, stepZone } from "../rules/zone.ts";
import { type Surface, surfaceAt, zoneSurfaces } from "../sim/zoneWalk.ts";
import { CATALOGUE } from "./art.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import {
  currentHazardNode,
  prepareRequiredRouteIntent,
  requiredRouteIntent,
  type RequiredRouteIntentTarget,
  routeHazardIntent,
  type RouteIntentCurrent,
  staticRouteAssist,
} from "./requiredRouteIntent.ts";

const surface: Surface = {
  area: "course",
  key: "landing",
  left: 100,
  mover: undefined,
  right: 200,
  y: 100,
};
const target: RequiredRouteIntentTarget = {
  index: 1,
  surface,
  window: { max: 120, min: 120 },
};
const current: RouteIntentCurrent = {
  area: surface.area,
  bird: { ...startBird(ORDINARY, { x: 100, y: 100 }), grounded: true, x: 110 },
  support: surface,
};

it("orders forward support windows geometrically before an exit declared first", () => {
  const prepared = prepareRequiredRouteIntent(ORDINARY, [
    { index: 0, interval: undefined, surface: { ...surface, key: "exit", left: 300, right: 400 } },
    { index: 1, interval: { max: 140, min: 140 }, surface },
    { index: 2, interval: { max: 120, min: 120 }, surface },
  ]);
  expect("targets" in prepared && prepared.targets.map(({ index }) => index)).toEqual([2, 1, 0]);
  expect("targets" in prepared && prepared.targets[0]?.window).toEqual({ max: 120, min: 120 });
});

it("selects only one lower static bank while preserving the original required goal", () => {
  const departure = { ...surface, left: 216, right: 264, y: 876 };
  const required = {
    index: 2,
    surface: { ...surface, key: "required", left: 480, right: 528, y: 912 },
    window: { max: 504, min: 480 },
  };
  const bank = { ...surface, key: "bank", left: 288, right: 432, y: 960 };
  const here = { ...current, bird: { ...current.bird, x: 220, y: 840 }, support: departure };
  expect(staticRouteAssist(ORDINARY, here, [departure, bank, required.surface], required)).toEqual({
    assist: { index: 2, surface: bank, window: { max: 408, min: 288 } },
  });
  expect(required.surface.left).toBe(480);
  expect(
    staticRouteAssist(
      ORDINARY,
      here,
      [bank, { ...bank, key: "other", left: 320, right: 400 }],
      required,
    ),
  ).toEqual({ unavailable: { index: 2, reason: "ambiguous-assist" } });
  expect(staticRouteAssist(ORDINARY, here, [{ ...bank, mover: 0 }], required)).toEqual({
    unavailable: { index: 2, reason: "dynamic-support" },
  });
});

function crossingFixture() {
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, {}, {}, new Set(), {
    areas: {
      course: {
        cols: 60,
        entries: { start: { col: 4, row: 50 } },
        objects: [{ character: "warned-vent", col: 10, row: 44 }],
        rows: 60,
        solids: [{ col: 0, cols: 60, row: 50, rows: 10 }],
      },
    },
    start: { area: "course", entry: "start" },
  });
  const initial = startZone(ORDINARY, layout, 1);
  const zone = { ...initial, bird: { ...initial.bird, grounded: true } };
  const surfaces = zoneSurfaces(ORDINARY, layout);
  const goal = {
    index: 0,
    surface: surfaceAt(TILE, surfaces, "course", { col: 16, row: 50 })!,
    window: { max: 16 * TILE, min: 16 * TILE },
  };
  const refuge = {
    index: 1,
    surface: surfaceAt(TILE, surfaces, "course", { col: 4, row: 50 })!,
    window: { max: zone.bird.x, min: zone.bird.x },
  };
  const context = { crossing: undefined, crossingSteps: 0, holding: 0, refuge };
  return { context, goal, layout, zone };
}

it("bounds only the current deterministic wait node and holds a safe refuge while warning", () => {
  const { context, goal, layout, zone } = crossingFixture();
  const warning = {
    ...zone,
    behaviours: zone.behaviours.map(
      (state) => state && { ...state, elapsed: 0.2, stateKey: "warning" },
    ),
  };
  expect(currentHazardNode(layout, warning, 0)).toMatchObject({
    phase: "warning",
    remaining: WARNED_VENT_SECONDS.warning - 0.2,
    stateKey: "warning",
  });
  expect(routeHazardIntent(ORDINARY, layout, warning, context, goal)).toEqual({ kind: "hold" });
  const active = {
    ...warning,
    behaviours: warning.behaviours.map((state) => state && { ...state, stateKey: "active" }),
  };
  expect(routeHazardIntent(ORDINARY, layout, active, context, goal)).toEqual({ kind: "hold" });
  expect(
    routeHazardIntent(ORDINARY, layout, warning, { ...context, holding: 1 }, goal),
  ).toMatchObject({ unavailable: { reason: "hazard-margin-unavailable" } });
  const recovery = {
    ...zone,
    behaviours: zone.behaviours.map(
      (state) => state && { ...state, elapsed: 0.2, stateKey: "recovery" },
    ),
  };
  expect(currentHazardNode(layout, recovery, 0)).toMatchObject({
    phase: "inactive",
    remaining: WARNED_VENT_SECONDS.recovery - 0.2,
    stateKey: "recovery",
  });
});

it("requires strict current-node margin and includes full body clearance plus the existing edge", () => {
  const { context, goal, layout, zone } = crossingFixture();
  const decision = routeHazardIntent(ORDINARY, layout, zone, context, goal);
  expect("kind" in decision && decision.kind).toBe("cross");
  if (!("crossing" in decision)) {
    throw new Error("Expected a flat crossing");
  }
  const hazard = decision.crossing.hazards[0]!;
  expect(decision.crossing.clearX).toBe(hazard.rect.x + hazard.rect.width + EDGE);
  const duration = (decision.crossing.upperTicks + 1) * STEP_SECONDS;
  const object = layout.areas.course!.objects[0]!;
  const plan = object.behaviour!;
  const inactive = plan.states.inactive!;
  const changed = {
    ...layout,
    areas: {
      course: {
        ...layout.areas.course!,
        objects: [
          {
            ...object,
            behaviour: {
              ...plan,
              states: {
                ...plan.states,
                inactive: {
                  ...inactive,
                  transitions: [
                    { to: "warning", when: [{ kind: "elapsed" as const, seconds: duration }] },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  };
  expect(routeHazardIntent(ORDINARY, changed, zone, context, goal)).toMatchObject({
    unavailable: { reason: "hazard-margin-unavailable" },
  });
  const early = {
    ...zone,
    behaviours: zone.behaviours.map((state) => state && { ...state, elapsed: -STEP_SECONDS }),
  };
  expect(currentHazardNode(layout, early, 0)).toBeUndefined();
  const unknown = {
    ...zone,
    behaviours: zone.behaviours.map((state) => state && { ...state, stateKey: "unknown" }),
  };
  expect(currentHazardNode(layout, unknown, 0)).toBeUndefined();
});

it.each([0, 48])("bounds native grounded acceleration and full crossing from vx=%s", (velocity) => {
  const fixture = crossingFixture();
  let zone = { ...fixture.zone, bird: { ...fixture.zone.bird, vx: velocity } };
  const initial = routeHazardIntent(ORDINARY, fixture.layout, zone, fixture.context, fixture.goal);
  if (!("crossing" in initial)) {
    throw new Error("Expected a flat crossing");
  }
  const crossing = initial.crossing;
  let ticks = 0;
  while (ticks < crossing.upperTicks && zone.bird.x <= crossing.clearX) {
    expect(
      routeHazardIntent(
        ORDINARY,
        fixture.layout,
        zone,
        { ...fixture.context, crossing, crossingSteps: ticks },
        fixture.goal,
      ),
    ).toMatchObject({ kind: "cross" });
    zone = stepZone(
      SKILL_PROFILES,
      ORDINARY,
      fixture.layout,
      STEP_SECONDS,
      { jumpHeld: false, move: 1, useHeld: false },
      zone,
    );
    ticks++;
    expect(zone.death).toBeUndefined();
    expect(zone.bird.grounded).toBe(true);
  }
  expect(zone.bird.x).toBeGreaterThan(crossing.clearX);
  expect(ticks).toBeLessThanOrEqual(crossing.upperTicks);
});

it("refuses negative or excessive velocity, carry, interrupted floors and blockers", () => {
  const { context, goal, layout, zone } = crossingFixture();
  for (const bird of [
    { ...zone.bird, vx: -1 },
    { ...zone.bird, vx: ORDINARY.walkSpeed + 1 },
    { ...zone.bird, carryVx: 1 },
  ]) {
    expect(routeHazardIntent(ORDINARY, layout, { ...zone, bird }, context, goal)).toMatchObject({
      unavailable: { reason: "hazard-margin-unavailable" },
    });
  }
  for (const solids of [
    [],
    [...layout.areas.course!.solids, { height: 36, width: 12, x: 80, y: 564 }],
  ]) {
    const obstructed = { ...layout, areas: { course: { ...layout.areas.course!, solids } } };
    expect(routeHazardIntent(ORDINARY, obstructed, zone, context, goal)).toMatchObject({
      unavailable: { reason: "hazard-margin-unavailable" },
    });
  }
  const object = layout.areas.course!.objects[0]!;
  const dynamic = {
    ...layout,
    areas: {
      course: {
        ...layout.areas.course!,
        objects: [
          {
            ...object,
            motion: { ...object.motion, algorithm: "linear" as const, distance: 12, speed: 12 },
          },
        ],
      },
    },
  };
  expect(currentHazardNode(dynamic, zone, 0)).toBeUndefined();
  const plan = object.behaviour!;
  const node = plan.states.inactive!;
  const branched = {
    ...layout,
    areas: {
      course: {
        ...layout.areas.course!,
        objects: [
          {
            ...object,
            behaviour: {
              ...plan,
              states: {
                ...plan.states,
                inactive: { ...node, transitions: [...node.transitions, ...node.transitions] },
              },
            },
          },
        ],
      },
    },
  };
  expect(currentHazardNode(branched, zone, 0)).toBeUndefined();
});

it("approaches an exact grounded refuge without requesting an early jump", () => {
  expect(requiredRouteIntent(ORDINARY, current, target)).toEqual({ inhibitNewJump: true, move: 1 });
  expect(
    requiredRouteIntent(ORDINARY, { ...current, bird: { ...current.bird, x: 120 } }, target),
  ).toEqual({ inhibitNewJump: true, move: 0 });
  expect(
    requiredRouteIntent(
      ORDINARY,
      { ...current, bird: { ...current.bird, vx: 24, x: 119.8 } },
      target,
    ),
  ).toEqual({ inhibitNewJump: true, move: 0 });
  expect(
    requiredRouteIntent(ORDINARY, { ...current, bird: { ...current.bird, x: 119.8 } }, target),
  ).toEqual({ inhibitNewJump: true, move: 1 });
});

it("brakes in the air before the required window using current velocity", () => {
  const flying = {
    ...current,
    bird: { ...current.bird, grounded: false, vx: 240, y: 20 },
    support: undefined,
  };
  const snapshot = structuredClone(flying);
  expect(requiredRouteIntent(ORDINARY, flying, target)).toEqual({ inhibitNewJump: false, move: 1 });
  expect(
    requiredRouteIntent(ORDINARY, { ...flying, bird: { ...flying.bird, x: 116 } }, target),
  ).toEqual({ inhibitNewJump: false, move: 0 });
  expect(flying).toEqual(snapshot);
});

it("allows a contiguous grounded descent instead of jumping over its landing", () => {
  const approach = {
    ...current,
    bird: { ...current.bird, x: 70, y: 44 },
    support: { ...surface, key: "upper", left: 0, right: 100, y: 80 },
  };
  expect(requiredRouteIntent(ORDINARY, approach, target)).toEqual({
    inhibitNewJump: true,
    move: 1,
  });
  expect(
    requiredRouteIntent(
      ORDINARY,
      { ...approach, support: { ...approach.support, right: 90 } },
      target,
    ),
  ).toEqual({ inhibitNewJump: false, move: 1 });
});

it("reports overshoot and descending below a missed support without changing the target", () => {
  expect(
    requiredRouteIntent(ORDINARY, { ...current, bird: { ...current.bird, x: 121 } }, target),
  ).toEqual({ unavailable: { index: 1, reason: "target-behind" } });
  expect(
    requiredRouteIntent(
      ORDINARY,
      {
        ...current,
        bird: { ...current.bird, grounded: false, vy: 20, x: 120, y: 100 },
        support: undefined,
      },
      target,
    ),
  ).toEqual({ unavailable: { index: 1, reason: "missed-support" } });
  expect(target.window).toEqual({ max: 120, min: 120 });
});

it("rejects missing, moving and unsafe target windows explicitly", () => {
  expect(
    prepareRequiredRouteIntent(ORDINARY, [{ index: 4, interval: undefined, surface: undefined }]),
  ).toEqual({ unavailable: { index: 4, reason: "missing-support" } });
  expect(
    prepareRequiredRouteIntent(ORDINARY, [
      { index: 4, interval: undefined, surface: { ...surface, mover: 0 } },
    ]),
  ).toEqual({ unavailable: { index: 4, reason: "dynamic-support" } });
  for (const interval of [
    { max: 120, min: 140 },
    { max: 190, min: 190 },
  ]) {
    expect(prepareRequiredRouteIntent(ORDINARY, [{ index: 4, interval, surface }])).toEqual({
      unavailable: { index: 4, reason: "invalid-window" },
    });
  }
  expect(requiredRouteIntent(ORDINARY, { ...current, area: "elsewhere" }, target)).toEqual({
    unavailable: { index: 1, reason: "area-mismatch" },
  });
  expect(requiredRouteIntent(ORDINARY, { ...current, support: undefined }, target)).toEqual({
    unavailable: { index: 1, reason: "unknown-ground-support" },
  });
  expect(
    requiredRouteIntent(ORDINARY, { ...current, bird: { ...current.bird, carryVx: 20 } }, target),
  ).toEqual({
    unavailable: { index: 1, reason: "carried-momentum" },
  });
  expect(
    prepareRequiredRouteIntent(ORDINARY, [
      {
        index: 4,
        interval: undefined,
        surface: { ...surface, right: surface.left + ORDINARY.width - 1 },
      },
    ]),
  ).toEqual({
    unavailable: { index: 4, reason: "invalid-window" },
  });
});
