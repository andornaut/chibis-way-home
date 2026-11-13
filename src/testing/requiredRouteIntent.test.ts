import { expect, it } from "vitest";

import { startBird } from "../rules/bird.ts";
import type { Surface } from "../sim/zoneWalk.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import {
  prepareRequiredRouteIntent,
  requiredRouteIntent,
  type RequiredRouteIntentTarget,
  type RouteIntentCurrent,
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
