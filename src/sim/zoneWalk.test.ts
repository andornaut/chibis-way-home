import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { REACH } from "../data/reach";
import { TILE } from "../data/screen";
import type { ZonePlan } from "../data/types";
import { TEST_ZONES, ZONES as FIXED_ZONES } from "../data/zones";
import { zoneLayout } from "../rules/tiles";
import { CATALOGUE, WALK_MS, walkSuite } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";
import { crosses, type Surface, walkZone, zoneSurfaces } from "./zoneWalk";

// Recipe stages are walked in chunkWalk.test.ts, alongside every individual chunk.
const ZONES: [string, ZonePlan][] = [
  ...Object.entries(FIXED_ZONES),
  ...TEST_ZONES.map((zone, index): [string, ZonePlan] => [`test ${index + 1}`, zone]),
];

describe.each(ZONES)("zone %s", (_, plan) => {
  walkSuite(plan);
});

// Ground at row 40 from col 0 to 20, where she starts, and a ledge rise tiles higher from col
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
  // Flat ground 120 wide, with a door on it where she must pass, or none.
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
    "ignores doors: a door on her way changes nothing it finds",
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
    "makes %s at her reach in one move, and never one tile more",
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
