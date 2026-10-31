import { describe, expect, it } from "vitest";

import { forceVisualPosition } from "./forceVisual";

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
