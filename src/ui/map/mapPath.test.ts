import { describe, expect, it } from "vitest";

import { MAP_PATH } from "../../data/layout";
import type { Point, Rect } from "../../data/types";
import { MAP_PATH_LOOKS } from "../layout/mapScreen";
import { bentCurve, curveWalk, dashInks, pathRects, type PathStroke, stampAt } from "./mapPath";

const STRAIGHT = 0;
// A level path 200 px long, trimmed 15 px from its start and 11 from its end.
const ENDS = { from: { x: 0, y: 0 }, fromTrim: 15, to: { x: 200, y: 0 }, toTrim: 11 };
const LEVEL = bentCurve(STRAIGHT, ENDS.from, ENDS.to, 0);
const TRIMMED = ENDS.to.x - ENDS.toTrim - ENDS.fromTrim;

const centreOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

// The runs of inked columns along a level path, and the gaps between them, in px.
function runs(rects: readonly Rect[]): { gaps: number[]; inked: number[] } {
  const columns = new Set(
    rects.flatMap((rect) => Array.from({ length: rect.width }, (_, i) => rect.x + i)),
  );
  const sorted = [...columns].sort((a, b) => a - b);
  const inked: number[] = [];
  const gaps: number[] = [];
  sorted.forEach((x, i) => {
    const before = sorted[i - 1];
    if (before === undefined || x - before > 1) {
      if (before !== undefined) {
        gaps.push(x - before - 1);
      }
      inked.push(1);
    } else {
      inked[inked.length - 1] = (inked.at(-1) ?? 0) + 1;
    }
  });
  return { gaps, inked };
}

describe("bentCurve", () => {
  it.each([
    ["even", 0, { x: 0, y: 0 }, { x: 100, y: 0 }, -1],
    ["odd", 1, { x: 0, y: 0 }, { x: 100, y: 0 }, 1],
    ["even", 2, { x: 50, y: 80 }, { x: 10, y: 20 }, -1],
    ["odd", 3, { x: 50, y: 80 }, { x: 10, y: 20 }, 1],
  ])(
    "bends an %s path (%i) by its share of the chord, to its side of travel",
    (_, index, from, to, side) => {
      const { control } = bentCurve(MAP_PATH.bend, from, to, index);
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const chord = { x: to.x - from.x, y: to.y - from.y };
      const push = { x: control.x - mid.x, y: control.y - mid.y };
      expect(Math.hypot(push.x, push.y)).toBeCloseTo(MAP_PATH.bend * Math.hypot(chord.x, chord.y));
      expect(Math.sign(chord.x * push.y - chord.y * push.x)).toBe(side);
    },
  );
});

describe("stampAt", () => {
  it.each([
    [2, { x: 10, y: 10 }, { height: 2, width: 2, x: 9, y: 9 }],
    [2, { x: 10.4, y: 10.6 }, { height: 2, width: 2, x: 9, y: 10 }],
    [4, { x: 10.5, y: 9.4 }, { height: 4, width: 4, x: 9, y: 7 }],
  ])("stamps a %i px square on %j at %j", (width, point, rect) => {
    expect(stampAt(width, point)).toEqual(rect);
  });
});

describe("dashInks", () => {
  it.each([
    [0, true],
    [6, true],
    [6.5, false],
    [9.5, false],
    [10, true],
  ])("inks the stamp %d px along 6 on, 4 off: %s", (distance, inks) => {
    expect(dashInks(6, 4, distance)).toBe(inks);
  });
});

describe("pathRects", () => {
  it.each([MAP_PATH_LOOKS.open.stroke, MAP_PATH_LOOKS.unbuilt.stroke])(
    "stops %j short of each centre",
    (stroke) => {
      const centres = pathRects(MAP_PATH.step, stroke, ENDS, LEVEL).map(centreOf);
      const xs = centres.map(({ x }) => x);
      expect(Math.min(...xs)).toBeCloseTo(ENDS.fromTrim, 0);
      expect(Math.max(...xs)).toBeCloseTo(ENDS.to.x - ENDS.toTrim, 0);
    },
  );

  it.each([MAP_PATH_LOOKS.built.stroke])(
    "dashes %j as on + width inked, off - width clear",
    (stroke) => {
      const { gaps, inked } = runs(pathRects(MAP_PATH.step, stroke, ENDS, LEVEL));
      expect(new Set(inked.slice(0, -1))).toEqual(new Set([stroke.on + stroke.width]));
      expect(new Set(gaps)).toEqual(new Set([stroke.off - stroke.width]));
    },
  );

  it("inks a solid path end to end", () => {
    const { stroke } = MAP_PATH_LOOKS.open;
    expect(runs(pathRects(MAP_PATH.step, stroke, ENDS, LEVEL)).gaps).toEqual([]);
  });

  it("spaces dots evenly about every px apart, one on each end", () => {
    const stroke: PathStroke = MAP_PATH_LOOKS.unbuilt.stroke;
    const rects = pathRects(MAP_PATH.step, stroke, ENDS, LEVEL);
    expect(rects).toHaveLength(Math.floor(TRIMMED / stroke.every) + 1);
  });
});

describe("map route travel", () => {
  it("clamps to the exact endpoints and measures travel distance along the rendered curve", () => {
    const path = curveWalk(bentCurve(MAP_PATH.bend, { x: 0, y: 0 }, { x: 200, y: 100 }, 0));
    expect(path.at(-10)).toEqual({ x: 0, y: 0 });
    expect(path.at(path.length + 10)).toEqual({ x: 200, y: 100 });
    expect(path.length).toBeGreaterThan(Math.hypot(200, 100));
    const straight = curveWalk(LEVEL);
    expect(straight.at(50)).toEqual({ x: 50, y: 0 });
    expect(straight.at(150)).toEqual({ x: 150, y: 0 });
  });
});
