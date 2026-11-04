import { describe, expect, it } from "vitest";

import { CAMERA } from "../data/camera";
import { cameraScroll, groundLine } from "./camera";

const SCREEN = { height: 360, width: 720 };
// Three screens tall and wide, its ground's top at 600 and 200 thick, room for the view to sit
// her two thirds down.
const AREA = { height: 1080, solids: [{ height: 200, width: 2160, x: 0, y: 600 }], width: 2160 };
// The same with the ground only 48 thick, so the view's bottom stops at the ground's bottom.
const THIN = { ...AREA, solids: [{ height: 48, width: 2160, x: 0, y: 600 }] };
const rest = (ground: number) => ground - CAMERA.groundSpot * SCREEN.height;

// Assembled from three chunks a screen wide: ground at 600, then a terrace at 480 over ground at
// 600 in the second, as the chunk's lowest, raised to 480 in the third, then a chunk of movers
// with no terrain.
const CHUNKS = [0, 720, 1440, 2160].map((x) => ({ width: 720, x }));
const ASSEMBLED = {
  chunks: CHUNKS,
  height: 1080,
  solids: [
    { height: 480, width: 720, x: 0, y: 600 },
    { height: 600, width: 360, x: 1440, y: 480 },
    { height: 600, width: 360, x: 1800, y: 480 },
  ],
  width: 2880,
};
const HALF = (CAMERA.seamEase * SCREEN.width) / 2;
const smooth = (t: number) => t * t * (3 - 2 * t);

describe("groundLine", () => {
  it.each([0, 1 / 4, 1 / 2])("reads a seam blend width of %s from tuning", (seamEase) => {
    const camera = { ...CAMERA, seamEase };
    const x = 1440 + (SCREEN.width * seamEase) / 4;
    expect(groundLine(camera, SCREEN, ASSEMBLED, x)).toBeCloseTo(
      seamEase === 0 ? 480 : 600 - 120 * smooth(0.75),
      9,
    );
  });

  it.each([
    ["a hand-built area: its lowest ground", AREA, 1000, 600],
    ["inside a chunk: its lowest ground", ASSEMBLED, 300, 600],
    ["inside a chunk with no terrain: the area's lowest ground", ASSEMBLED, 1000, 600],
    ["inside a raised chunk: its ground", ASSEMBLED, 1800, 480],
    ["at a seam: halfway between the chunks' grounds", ASSEMBLED, 1440, 540],
    ["a quarter into a seam's ease", ASSEMBLED, 1440 - HALF / 2, 600 - 120 * smooth(0.25)],
    ["at the end of a seam's ease: the next chunk's ground", ASSEMBLED, 1440 + HALF, 480],
    ["past the last chunk's seam: the area's lowest ground", ASSEMBLED, 2600, 600],
  ])("is, in %s,", (_, area, x, line) => {
    expect(groundLine(CAMERA, SCREEN, area, x)).toBeCloseTo(line, 9);
  });
});

describe("cameraScroll", () => {
  it.each([1 / 2, 3 / 4])("reads a ground resting position of %s from tuning", (groundSpot) => {
    const camera = { ...CAMERA, groundSpot };
    const feet = { x: 1000, y: 600 };
    expect(cameraScroll(camera, SCREEN, AREA, feet).y).toBe(
      Math.round(600 - groundSpot * SCREEN.height),
    );
  });

  it.each([
    [
      "on the ground, two thirds down the screen",
      AREA,
      { x: 1000, y: 600 },
      { x: 640, y: rest(600) },
    ],
    [
      "a little above the ground, the view still",
      AREA,
      { x: 1000, y: 560 },
      { x: 640, y: rest(600) },
    ],
    [
      "above the middle, the view risen to keep her there",
      AREA,
      { x: 1000, y: 300 },
      { x: 640, y: 120 },
    ],
    ["at the area's top, the view at its top", AREA, { x: 1000, y: 40 }, { x: 640, y: 0 }],
    [
      "on thin ground, the view's bottom at the ground's",
      THIN,
      { x: 1000, y: 600 },
      { x: 640, y: 288 },
    ],
    [
      "near the left end, the view at the area's left",
      AREA,
      { x: 100, y: 600 },
      { x: 0, y: rest(600) },
    ],
    [
      "near the right end, the view at the area's right",
      AREA,
      { x: 2100, y: 600 },
      { x: 1440, y: rest(600) },
    ],
    [
      "on a raised chunk's ground, two thirds down the screen",
      ASSEMBLED,
      { x: 1800, y: 480 },
      { x: 1440, y: rest(480) },
    ],
    [
      "at a seam, the view between the two chunks' rests",
      ASSEMBLED,
      { x: 1440, y: 480 },
      { x: 1080, y: rest(540) },
    ],
  ])("puts her %s", (_, area, feet, scroll) => {
    expect(cameraScroll(CAMERA, SCREEN, area, feet)).toEqual(scroll);
  });

  it.each([
    ["an area no wider than the screen", { height: 360, solids: [], width: 720 }, { x: 0, y: 0 }],
    ["an area with no terrain", { height: 720, solids: [], width: 2160 }, { x: 640, y: 0 }],
  ])("keeps the view inside %s", (_, area, scroll) => {
    expect(cameraScroll(CAMERA, SCREEN, area, { x: 1000, y: 300 })).toEqual(scroll);
  });
});
