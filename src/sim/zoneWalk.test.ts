import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { REACH } from "../data/reach";
import { TILE } from "../data/screen";
import type { ZonePlan } from "../data/types";
import { SKILL_PROFILES } from "../progress";
import { zoneLayout } from "../rules/tiles";
import { startZone, stepZone } from "../rules/zone";
import { CATALOGUE, WALK_MS, walkSuite } from "../testing/walkSuite";
import { TEST_ZONES } from "../testing/zones";
import { type WalkStep, walkTransitions as memoizeTransitions } from "./walkTransitions";
import { crosses, type Surface, walkZone, zoneSurfaces } from "./zoneWalk";

// Recipe stages are walked in chunkWalk.test.ts, alongside every individual chunk.
const ZONES: [string, ZonePlan][] = TEST_ZONES.map((zone, index): [string, ZonePlan] => [
  `test ${index + 1}`,
  zone,
]);

describe.each(ZONES)("zone %s", (_, plan) => {
  walkSuite(plan);
});

// Ground at row 40 from col 0 to 20, where he starts, and a ledge rise tiles higher from col
// 20 + gap on.
function course(gap: number, rise: number): ZonePlan {
  return {
    areas: {
      course: {
        cols: 60 + gap,
        entries: { start: { col: 10, row: 40 } },
        objects: [],
        rows: 60,
        solids: [
          { col: 0, cols: 20, row: 40, rows: 20 },
          { col: 20 + gap, cols: 40, row: 40 - rise, rows: 20 + rise },
        ],
      },
    },
    start: { area: "course", entry: "start" },
  };
}

describe("walkZone", () => {
  // Flat ground 120 wide, with a door on it where he must pass, or none.
  const street = (doors: number): ZonePlan => ({
    areas: {
      street: {
        cols: 120,
        entries: { start: { col: 4, row: 50 } },
        objects: Array.from({ length: doors }, () => ({
          character: "test-door",
          col: 60,
          room: "test",
          row: 46,
        })),
        rows: 60,
        solids: [{ col: 0, cols: 120, row: 50, rows: 10 }],
      },
    },
    start: { area: "street", entry: "start" },
  });

  it(
    "ignores doors: a door on his way changes nothing it finds",
    () => {
      const walk = (doors: number) => {
        const { cleared, reached } = walkZone(
          BIRD,
          zoneLayout(TILE, BIRD_FRAME, CATALOGUE, {}, {}, new Set(), street(doors)),
        );
        return { cleared, reached: [...reached].sort() };
      };
      expect(walk(1)).toEqual({ ...walk(0), cleared: true });
    },
    WALK_MS,
  );
});

describe("crosses", () => {
  it.each([
    ["a gap", REACH.gap, 0, REACH.gap + 1, 0],
    ["a rise", 0, REACH.jump, 0, REACH.jump + 1],
  ])(
    "makes %s at his reach in one move, and never one tile more",
    (_, gap, rise, gapOver, riseOver) => {
      const makes = (plan: ZonePlan) => {
        const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, {}, {}, new Set(), plan);
        const surfaces = zoneSurfaces(BIRD, layout);
        const [start, end] = [...surfaces].sort((a, b) => a.left - b.left) as [Surface, Surface];
        return crosses(BIRD, layout, surfaces, start, end);
      };
      expect([makes(course(gap, rise)), makes(course(gapOver, riseOver))]).toEqual([true, false]);
    },
    WALK_MS,
  );
});

function transitionCourse(): ZonePlan {
  return {
    areas: {
      course: {
        cols: 24,
        entries: { start: { col: 2, row: 50 } },
        objects: [
          {
            character: "test-mover",
            col: 8,
            overrides: { motion: { distance: 2, pause: 0, speed: 2, variance: 0.2 } },
            phase: 0,
            row: 46,
          },
          { character: "test-hazard", col: 16, row: 49 },
        ],
        rows: 60,
        solids: [{ col: 0, cols: 24, row: 50, rows: 10 }],
      },
    },
    start: { area: "course", entry: "start" },
  };
}

function frozen<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      frozen(child);
    }
  }
  return value;
}

describe("walk transition prerequisites", () => {
  it("replays exact inputs without mutating a frozen state or layout, including lazy mover tracks", () => {
    const layout = frozen(
      zoneLayout(TILE, BIRD_FRAME, CATALOGUE, {}, {}, new Set(), transitionCourse()),
    );
    const state = frozen(startZone(BIRD, layout, 42));
    const input = frozen({ jumpHeld: true, move: 1 as const, useHeld: false });
    const original = JSON.stringify(state);
    const first = stepZone(SKILL_PROFILES, BIRD, layout, STEP_SECONDS, input, state);
    state.tracks[0]!.at(20);
    expect(stepZone(SKILL_PROFILES, BIRD, layout, STEP_SECONDS, input, state)).toEqual(first);
    expect(JSON.stringify(state)).toBe(original);
    expect(first).not.toBe(state);
    expect(first.objects[0]).not.toEqual(state.objects[0]);
  });
});

describe("walk transition cache", () => {
  it("reuses an actual lethal transition independently of walker search order", () => {
    const layout = frozen(
      zoneLayout(TILE, BIRD_FRAME, CATALOGUE, {}, {}, new Set(), transitionCourse()),
    );
    const step = vi.fn<WalkStep>((input, state) =>
      stepZone(SKILL_PROFILES, BIRD, layout, STEP_SECONDS, input, state),
    );
    const advance = memoizeTransitions(step);
    const input = frozen({ jumpHeld: false, move: 1 as const, useHeld: false });
    let state = frozen(startZone(BIRD, layout, 42));
    let previous = state;
    const limit = Math.ceil(
      (layout.areas.course!.width / BIRD.walkSpeed + BIRD.walkSpeed / BIRD.groundAccel) /
        STEP_SECONDS,
    );
    for (let tick = 0; tick < limit && state.death === undefined; tick++) {
      previous = state;
      state = frozen(advance(input, state));
    }
    expect(state.death).toMatchObject({
      contact: { index: 1, kind: "object" },
      reason: "hazard",
    });
    const calls = step.mock.calls.length;
    expect(advance(input, previous)).toEqual(state);
    expect(step).toHaveBeenCalledTimes(calls);
  });

  it("preserves mover-course search results and ordered states with fewer physics calls", async () => {
    async function run(cached: boolean) {
      vi.resetModules();
      const engine = await import("../rules/zone");
      const calls = vi.spyOn(engine, "stepZone");
      const trace = createHash("sha256");
      let transitions = 0;
      let lethalSteps = 0;
      vi.doMock("./walkTransitions", () => ({
        walkTransitions: (step: WalkStep): WalkStep => {
          const advance = cached ? memoizeTransitions(step) : step;
          return (input, zone) => {
            const next = advance(input, zone);
            trace.update(JSON.stringify({ input, next }));
            transitions++;
            if (next.death !== undefined) {
              lethalSteps++;
            }
            return next;
          };
        },
      }));
      try {
        const walker = await import("./zoneWalk");
        const layout = frozen(
          zoneLayout(TILE, BIRD_FRAME, CATALOGUE, {}, {}, new Set(), transitionCourse()),
        );
        const result = walker.walkZone(BIRD, layout);
        return {
          calls: calls.mock.calls.length,
          lethalSteps,
          result,
          trace: trace.digest("hex"),
          transitions,
        };
      } finally {
        calls.mockRestore();
        vi.doUnmock("./walkTransitions");
      }
    }
    const original = await run(false);
    const cached = await run(true);
    expect(cached.result).toEqual(original.result);
    expect(cached.transitions).toBe(original.transitions);
    expect(cached.trace).toBe(original.trace);
    expect(cached.lethalSteps).toBe(original.lethalSteps);
    expect(cached.calls).toBeLessThan(original.calls);
    expect(cached.result.cleared).toBe(true);
    console.log(
      "Walk transition proof",
      JSON.stringify({
        cached: cached.calls,
        lethalSteps: cached.lethalSteps,
        orderedStateTrace: cached.trace,
        original: original.calls,
        steps: cached.result.steps,
        trialTransitions: cached.transitions,
      }),
    );
  });
});
