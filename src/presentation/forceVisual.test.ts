import { describe, expect, it } from "vitest";

import { forceVisualPosition, forceVisualSpan } from "./forceVisual";

describe("force visual frame placement", () => {
  it.each([
    { facing: 1 as const, x: 136 },
    { facing: -1 as const, x: 64 },
  ])("mirrors the visual without changing physical volume $facing", ({ facing, x }) => {
    expect(
      forceVisualPosition(
        { height: 48, width: 48 },
        { height: 48, width: 48 },
        { height: 32, width: 48 },
        { x: 36, y: 6 },
        facing,
        { x: 100, y: 200 },
      ),
    ).toEqual({ x, y: 206 });
  });
});

describe("force visual span", () => {
  const volume = { height: 48, width: 288, x: 100, y: 200 };
  const wave = { height: 32, width: 48 };

  it("repeats whole copies edge to edge from the source, bottoms on the volume bottom", () => {
    expect(forceVisualSpan(volume, wave, 1)).toEqual(
      [100, 148, 196, 244, 292, 340].map((x) => ({ x, y: 216 })),
    );
    expect(forceVisualSpan(volume, wave, -1)).toEqual(
      [340, 292, 244, 196, 148, 100].map((x) => ({ x, y: 216 })),
    );
  });

  it("spaces the nearest whole count evenly across a width that is not a multiple", () => {
    const xs = forceVisualSpan({ ...volume, width: 130 }, wave, 1).map(({ x }) => x);
    expect(xs).toEqual([100, 141, 182]);
    expect(forceVisualSpan({ ...volume, width: 20 }, wave, -1)).toEqual([{ x: 72, y: 216 }]);
  });
});
