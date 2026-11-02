import { describe, expect, it } from "vitest";

import { DASH_TRAIL } from "../data/dashTrail";
import { BIRD_FRAME } from "./bird";
import { dashTrail } from "./dashTrail";

const duration = 0.25;
const frame = { ...BIRD_FRAME, x: 100, y: 80 };
const active = { direction: 1, remainingSeconds: duration } as const;

describe("dash wind outside the full padded frame", () => {
  it.each(DASH_TRAIL.lines.map((line, index) => ({ index, line })))(
    "mirrors line $index with its complete frame gap empty",
    ({ line }) => {
      const right = dashTrail(DASH_TRAIL, duration, frame, active).filter(
        (pixel) => pixel.y === frame.y + line.y,
      );
      const left = dashTrail(DASH_TRAIL, duration, frame, { ...active, direction: -1 }).filter(
        (pixel) => pixel.y === frame.y + line.y,
      );
      expect(right).toHaveLength(line.length);
      expect(right[0]!.x + 1).toBe(frame.x - line.gap);
      expect(left[0]!.x).toBe(frame.x + frame.width + line.gap);
      expect(left).toEqual(
        right.map((pixel) => ({ ...pixel, x: 2 * frame.x + frame.width - 1 - pixel.x })),
      );
      expect(
        right.every((pixel) => pixel.height === DASH_TRAIL.thickness && pixel.x < frame.x),
      ).toBe(true);
      expect(left.every((pixel) => pixel.x >= frame.x + frame.width)).toBe(true);
      expect(right.at(-1)?.alpha).toBe(0);
    },
  );
  it("shortens and fades with actual normalized active age and has no post-dash tail", () => {
    const full = dashTrail(DASH_TRAIL, duration, frame, active);
    const half = dashTrail(DASH_TRAIL, duration, frame, {
      ...active,
      remainingSeconds: duration / 2,
    });
    expect(
      DASH_TRAIL.lines.map((line) => half.filter((pixel) => pixel.y === frame.y + line.y).length),
    ).toEqual([28, 21, 14]);
    expect(
      DASH_TRAIL.lines.map((line) => half.find((pixel) => pixel.y === frame.y + line.y)!.alpha),
    ).toEqual([92, 77, 63]);
    expect(full[15]!.alpha).toBe(99);
    expect(half.length).toBeLessThan(full.length);
    expect(half[0]!.alpha).toBeGreaterThan(0);
    expect(half[0]!.alpha).toBeLessThan(full[0]!.alpha);
    expect(half).toEqual(
      dashTrail(DASH_TRAIL, duration * 2, frame, { ...active, remainingSeconds: duration }),
    );
    expect(dashTrail(DASH_TRAIL, duration, frame, { ...active, remainingSeconds: 0 })).toEqual([]);
    expect(dashTrail(DASH_TRAIL, duration, frame, undefined)).toEqual([]);
  });
});
