import { expect, it, vi } from "vitest";

import { CERTIFIED_LISTS } from "../data/certified/index.ts";
import type { Rect, ZoneLayout } from "../data/types/index.ts";
import { startBird } from "../rules/bird.ts";
import type { ZoneState } from "../rules/zone.ts";
import * as zoneRules from "../rules/zone.ts";
import type { Surface } from "../sim/zoneWalk.ts";
import { continuousRequiredRoute, controlledRequiredRoute } from "./continuousRequiredRoute.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import { createGroundedGapController, GROUNDED_GAP_CONTROLLER } from "./groundedGapController.ts";
import { groundedGapSourceFiles, qualifyGroundedGapRoute } from "./groundedGapQualification.ts";
import type { Proof } from "./pairCertify.ts";
import * as routeIntent from "./requiredRouteIntent.ts";
import { completePairProposal, preparePairProposal } from "./selectedCertification.ts";
const support: Surface = {
  area: "main",
  key: "main:still:72,924",
  left: 72,
  mover: undefined,
  right: 144,
  y: 924,
};
const target = {
  index: 0,
  surface: { ...support, key: "main:still:276,888", left: 276, right: 312, y: 888 },
  window: { max: 288, min: 276 },
};
function layout(extra: readonly Rect[] = []): ZoneLayout {
  return {
    areas: {
      main: {
        height: 1440,
        objects: [],
        solids: [
          { height: 516, width: 72, x: 72, y: 924 },
          { height: 552, width: 36, x: 276, y: 888 },
          ...extra,
        ],
        width: 720,
      },
    },
  } as unknown as ZoneLayout;
}
function state(patch: Partial<ZoneState["bird"]> = {}): ZoneState {
  return {
    area: "main",
    behaviours: [],
    bird: {
      ...startBird(ORDINARY, { x: 100, y: 924 }),
      grounded: true,
      vx: ORDINARY.walkSpeed,
      ...patch,
    },
    cleared: false,
    death: undefined,
    objects: [],
    transients: [],
    turnedBack: false,
  } as unknown as ZoneState;
}
const current = (zone: ZoneState) => ({
  area: zone.area,
  bird: zone.bird,
  support: zone.bird.grounded ? support : undefined,
});
it("gates the supported press and releases only after observed ascent", () => {
  const gap = createGroundedGapController(ORDINARY, layout());
  const held = state({ jumpHeld: true });
  const reset = gap.controller.input("none", current(held), target, 1)!;
  if (!("input" in reset)) {
    throw new Error("Expected release before takeoff");
  }
  gap.controller.observe(0, reset.input, held, state());
  expect(gap.events).toEqual([]);
  expect(gap.controller.input("none", current(state()), target, 1)).toEqual({
    input: { jumpHeld: false, move: 1, useHeld: false },
  });
  const before = state({ x: 142 });
  const press = gap.controller.input("none", current(before), target, 1)!;
  expect(press).toEqual({ input: { jumpHeld: true, move: 1, useHeld: false } });
  if (!("input" in press)) {
    throw new Error("Expected press");
  }
  const rising = state({
    grounded: false,
    jumpHeld: true,
    jumpRise: "held",
    vy: -400,
    x: 144,
    y: 883,
  });
  gap.controller.observe(1, press.input, before, rising);
  expect(gap.controller.input("none", current(rising), target, 1)).toEqual(press);
  const apex = state({ grounded: false, jumpHeld: true, jumpRise: "free", vy: 0, x: 210, y: 810 });
  gap.controller.observe(2, press.input, rising, apex);
  const release = gap.controller.input("none", current(apex), target, 1)!;
  expect(release).toEqual({ input: { jumpHeld: false, move: 1, useHeld: false } });
  if (!("input" in release)) {
    throw new Error("Expected release");
  }
  const falling = state({ grounded: false, jumpHeld: false, vy: 15, x: 212, y: 811 });
  gap.controller.observe(3, release.input, apex, falling);
  gap.controller.observe(4, release.input, falling, state({ jumpHeld: false, x: 276, y: 852 }));
  expect(gap.events.map(({ kind }) => kind)).toEqual([
    "takeoff",
    "apex",
    "release",
    "first-fall",
    "landing",
  ]);
  expect(gap.events.at(-1)?.after.support?.key).toBe(target.surface.key);
  expect(gap.failure()).toBeUndefined();
});
it("marks ceiling interruption separately and fails closed for unsupported carried launches", () => {
  const gap = createGroundedGapController(
    ORDINARY,
    layout([{ height: 60, width: 100, x: 120, y: 820 }]),
  );
  const before = state({ x: 142 });
  const press = gap.controller.input("none", current(before), target, 1)!;
  if (!("input" in press)) {
    throw new Error("Expected press");
  }
  gap.controller.observe(
    1,
    press.input,
    before,
    state({ grounded: false, jumpHeld: true, vy: 0, x: 144, y: 880 }),
  );
  expect(gap.events.map(({ kind }) => kind)).toEqual(["takeoff", "interrupted"]);
  expect(gap.failure()).toBe("interrupted");
  expect(gap.controller.input("none", current(before), target, 1)).toHaveProperty("unavailable");
  const wall = createGroundedGapController(
    ORDINARY,
    layout([{ height: 100, width: 12, x: 168, y: 800 }]),
  );
  wall.controller.input("none", current(before), target, 1);
  wall.controller.observe(
    1,
    press.input,
    before,
    state({ grounded: false, jumpHeld: true, vx: 0, vy: -400, x: 144, y: 883 }),
  );
  expect(wall.failure()).toBe("interrupted");
  const carried = createGroundedGapController(ORDINARY, layout());
  expect(
    carried.controller.input("none", current(state({ carryVx: 10 })), target, 1),
  ).toHaveProperty("unavailable");
  const overspeed = createGroundedGapController(ORDINARY, layout());
  expect(
    overspeed.controller.input("none", current(state({ vx: ORDINARY.walkSpeed + 1 })), target, 1),
  ).toHaveProperty("unavailable");
});
it("retains default inputs and the complete result through a mocked native step", () => {
  const zone = state();
  const initialize = vi.spyOn(zoneRules, "startZone").mockReturnValue(zone);
  const step = vi
    .spyOn(zoneRules, "stepZone")
    .mockReturnValue({ ...zone, bird: { ...zone.bird, x: 102 }, cleared: true });
  try {
    const result = continuousRequiredRoute(layout(), []);
    expect(result).toEqual({
      assistWitnesses: [],
      controller: "required-route-intent-v2",
      missing: [],
      reason: "cleared",
      status: "proven",
      terminal: { area: "main", cleared: true, grounded: true, x: 102, y: zone.bird.y },
      ticks: 1,
      unavailable: undefined,
      witnesses: [],
    });
    expect(step).toHaveBeenCalledOnce();
    expect(step.mock.calls[0]?.[4]).toEqual({ jumpHeld: true, move: 1, useHeld: false });
    const gap = createGroundedGapController(ORDINARY, layout());
    expect(controlledRequiredRoute(gap.controller, layout(), [])).toEqual({
      ...result,
      controller: GROUNDED_GAP_CONTROLLER,
    });
    expect(step.mock.calls[1]?.[4]).toEqual(step.mock.calls[0]?.[4]);
    expect(gap.decisions).toMatchObject([
      {
        appliedTick: 1,
        current: { bird: { x: zone.bird.x } },
        input: { jumpHeld: true, move: 1, useHeld: false },
        owner: "generic",
        preStepTick: 0,
        variant: { eligibility: "not-eligible", phaseBefore: "inactive" },
      },
    ]);
  } finally {
    initialize.mockRestore();
    step.mockRestore();
  }
});
it("rejects incomplete source metadata before any route and cannot be submitted as native certification", () => {
  const step = vi.spyOn(zoneRules, "stepZone");
  try {
    const result = qualifyGroundedGapRoute(undefined, layout(), []);
    expect(result).toMatchObject({
      controller: GROUNDED_GAP_CONTROLLER,
      kind: "qualification",
      reason: "source-unavailable",
      source: { status: "unavailable" },
      status: "not-proven",
    });
    expect(
      qualifyGroundedGapRoute(
        { files: {}, revision: "a".repeat(40), themes: ["fixture"] },
        layout(),
        [],
      ),
    ).toHaveProperty("reason", "source-unavailable");
    expect(Object.keys(groundedGapSourceFiles())).toContain("src/testing/groundedGapController.ts");
    expect(step).not.toHaveBeenCalled();
    const selected = "industrial-crane-lookout--industrial-low-roof-strip";
    const currentList = CERTIFIED_LISTS.find(({ zone }) => zone === "industrial")!;
    const plan = preparePairProposal(
      "industrial",
      { ...currentList, entries: currentList.entries.filter(({ id }) => id !== selected) },
      [selected],
    );
    expect(() => completePairProposal(plan, [result as unknown as Proof])).toThrow();
  } finally {
    step.mockRestore();
  }
});

it("fails closed before a gap press when timed hazard hold or cross owns input", () => {
  const initialize = vi.spyOn(zoneRules, "startZone").mockReturnValue(state({ x: 142 }));
  const step = vi.spyOn(zoneRules, "stepZone");
  const hazard = vi.spyOn(routeIntent, "routeHazardIntent");
  try {
    for (const ownership of ["hold", "cross"] as const) {
      if (ownership === "hold") {
        hazard.mockReturnValueOnce({ kind: "hold" });
      } else {
        hazard.mockReturnValueOnce({
          crossing: {
            clearX: 300,
            floor: { height: 516, width: 72, x: 72, y: 924 },
            hazards: [],
            requiredIndex: 0,
            upperTicks: 1,
          },
          kind: "cross",
        });
      }
      const gap = createGroundedGapController(ORDINARY, layout());
      const result = controlledRequiredRoute(gap.controller, layout(), [
        { area: "main", at: { col: 24, row: 74 } },
      ]);
      expect(result).toMatchObject({
        status: "not-proven",
        ticks: 0,
        unavailable: { index: 0, reason: "hazard-margin-unavailable" },
      });
      expect(gap.failure()).toBe("timed-hazard-owned");
      expect(gap.events).toEqual([]);
      expect(gap.guardEvents).toMatchObject([
        {
          bird: { grounded: true, x: 142 },
          move: ownership === "hold" ? 0 : 1,
          ownership,
          tick: 0,
        },
      ]);
      expect(gap.decisions).toMatchObject([
        {
          controllerConsulted: true,
          hazardOwnership: ownership,
          owner: "guarded-stop",
          preStepTick: 0,
          variant: { eligibility: "rejected" },
        },
      ]);
      expect(gap.decisions[0]).not.toHaveProperty("appliedTick");
      expect(gap.decisions[0]).not.toHaveProperty("input");
    }
    hazard.mockReturnValueOnce({ unavailable: { index: 0, reason: "hazard-margin-unavailable" } });
    const rejected = createGroundedGapController(ORDINARY, layout());
    const consult = vi.spyOn(rejected.controller, "input");
    controlledRequiredRoute(rejected.controller, layout(), [
      { area: "main", at: { col: 24, row: 74 } },
    ]);
    expect(consult).not.toHaveBeenCalled();
    expect(rejected.decisions).toMatchObject([
      {
        controllerConsulted: false,
        owner: "guarded-stop",
        preStepTick: 0,
        variant: { eligibility: "unknown", phaseAfterInput: "unknown", phaseBefore: "unknown" },
      },
    ]);
    expect(rejected.decisions[0]).not.toHaveProperty("input");
    expect(rejected.decisions[0]).not.toHaveProperty("appliedTick");
    expect(step).not.toHaveBeenCalled();
  } finally {
    initialize.mockRestore();
    step.mockRestore();
    hazard.mockRestore();
  }
});

it("records an owned decision without changing the selected input or route result", () => {
  const zone = state();
  const initialize = vi.spyOn(zoneRules, "startZone").mockReturnValue(zone);
  const step = vi.spyOn(zoneRules, "stepZone").mockReturnValue({ ...zone, cleared: true });
  try {
    const plain = createGroundedGapController(ORDINARY, layout());
    const silent = {
      id: plain.controller.id,
      input: plain.controller.input,
      observe: plain.controller.observe,
    };
    const targets = [{ area: "main", at: { col: 24, row: 74 } }];
    const expected = controlledRequiredRoute(silent, layout(), targets);
    const observed = createGroundedGapController(ORDINARY, layout());
    expect(controlledRequiredRoute(observed.controller, layout(), targets)).toEqual(expected);
    expect(step.mock.calls[0]?.[4]).toEqual({ jumpHeld: false, move: 1, useHeld: false });
    expect(step.mock.calls[1]?.[4]).toEqual(step.mock.calls[0]?.[4]);
    expect(plain.decisions).toEqual([]);
    expect(observed.decisions).toMatchObject([
      {
        appliedTick: 1,
        current: { support: { left: 72, right: 144, y: 924 } },
        input: { jumpHeld: false, move: 1, useHeld: false },
        owner: "variant",
        preStepTick: 0,
        target: { index: 0, surface: { left: 276, right: 312 }, window: { max: 288, min: 276 } },
        variant: {
          eligibility: "owned",
          gate: { nextVX: 240, press: false, supportRight: 144 },
          phaseAfterInput: "approach",
          phaseBefore: "inactive",
        },
      },
    ]);
  } finally {
    initialize.mockRestore();
    step.mockRestore();
  }
});
