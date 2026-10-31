import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype } from "../data/types";
import { walkZone } from "../sim/zoneWalk";
import { BIRD_FRAME } from "../view/bird";
import { attemptProgress, deathSupport } from "./death";
import { zoneLayout } from "./tiles";
import { startZone } from "./zone";

const LEDGE: Archetype = {
  collision: "ledge",
  interaction: { kind: "none", range: 0 },
  motion: {
    algorithm: "static",
    direction: "right",
    distance: 0,
    hopHeight: 0,
    pause: 0,
    speed: 0,
    variance: 0,
  },
  reaction: { kind: "none", range: 0, speed: 0 },
};
const LAYOUT = zoneLayout(
  12,
  BIRD_FRAME,
  {
    archetypes: { ledge: LEDGE },
    characters: { ledge: { archetype: "ledge", art: "placeholder-ledge", cols: 4, rows: 1 } },
  },
  {},
  {},
  new Set(),
  {
    areas: {
      course: {
        cols: 60,
        entries: { start: { col: 4, row: 20 } },
        objects: [{ character: "ledge", col: 10, row: 12 }],
        rows: 30,
        solids: [{ col: 0, cols: 60, row: 20, rows: 10 }],
      },
    },
    start: { area: "course", entry: "start" },
  },
);
const FROZEN = { ...startZone(BIRD, LAYOUT, 1), objects: [{ x: 200, y: 160 }] };

describe("death support", () => {
  it.each([
    { support: 160, x: 205, y: 100 },
    { support: 240, x: 125, y: 100 },
    { support: 240, x: 205, y: 200 },
    { support: undefined, x: 800, y: 100 },
  ])("uses the nearest frozen support under the actual body: %j", ({ support, x, y }) => {
    expect(deathSupport(BIRD, LAYOUT, FROZEN, { x, y })?.y).toBe(support);
  });
});

describe("attempt progress", () => {
  it.each([
    [50, 0.5],
    [90, 0.9],
    [20, 0.2],
    [0, 0],
    [-10, 0],
    [120, 1],
  ])("reports current position %s, including backtracking and retry", (position, expected) => {
    expect(attemptProgress(0, 100, position)).toBe(expected);
  });
});

it("rejects a simulated attempt that dies while settling instead of treating it as reachable", () => {
  const area = LAYOUT.areas.course;
  const object = area?.objects[0];
  if (!area || !object) {
    throw new Error("Missing fixture area");
  }
  const layout = {
    ...LAYOUT,
    areas: {
      course: {
        ...area,
        objects: [
          {
            ...object,
            collision: "hazard" as const,
            height: 24,
            origin: { x: 36, y: 216 },
            width: 48,
          },
        ],
      },
    },
  };
  const walked = walkZone(BIRD, layout);
  expect(walked.cleared).toBe(false);
  expect(walked.reached.size).toBe(0);
});
