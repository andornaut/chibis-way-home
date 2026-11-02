import { describe, expect, it } from "vitest";

import { DASH_TRAIL } from "../data/dashTrail";
import { BIRD_FRAME } from "./bird";
import { dashTrail } from "./dashTrail";

const duration = 0.25;
const frame = { ...BIRD_FRAME, x: 100, y: 80 };
const active = { direction: 1, remainingSeconds: duration } as const;

describe("bordered dash wind outside the full padded frame", () => {
  it.each(DASH_TRAIL.lines.map((line, index) => ({ index, line })))(
    "mirrors line $index while keeping the outer border gap empty",
    ({ line }) => {
      const pixels = dashTrail(DASH_TRAIL, duration, frame, active);
      const right = pixels.filter(
        (pixel) => pixel.y === frame.y + line.y - DASH_TRAIL.borderThickness,
      );
      const mirrored = dashTrail(DASH_TRAIL, duration, frame, { ...active, direction: -1 });
      const left = mirrored.filter(
        (pixel) => pixel.y === frame.y + line.y - DASH_TRAIL.borderThickness,
      );
      const leftCore = mirrored.filter((pixel) => pixel.y === frame.y + line.y);
      const core = pixels.filter((pixel) => pixel.y === frame.y + line.y);
      expect(right).toHaveLength(line.length + 2 * DASH_TRAIL.borderThickness);
      expect(core).toHaveLength(line.length);
      expect(right[0]!.x + 1).toBe(frame.x - line.gap);
      expect(left[0]!.x).toBe(frame.x + frame.width + line.gap);
      expect(core[0]!.x + core[0]!.width).toBe(frame.x - line.gap - DASH_TRAIL.borderThickness);
      expect(leftCore[0]!.x).toBe(frame.x + frame.width + line.gap + DASH_TRAIL.borderThickness);
      expect(leftCore).toEqual(
        core.map((pixel) => ({ ...pixel, x: 2 * frame.x + frame.width - 1 - pixel.x })),
      );
      expect(core[0]!.height).toBe(DASH_TRAIL.thickness);
      expect(right[0]!.height).toBe(DASH_TRAIL.thickness + 2 * DASH_TRAIL.borderThickness);
      expect(left).toEqual(
        right.map((pixel) => ({ ...pixel, x: 2 * frame.x + frame.width - 1 - pixel.x })),
      );
      expect(pixels.every((pixel) => pixel.x + pixel.width <= frame.x)).toBe(true);
      expect(right.at(-1)?.alpha).toBe(0);
      expect(core.at(-1)!.alpha).toBeLessThan(core[0]!.alpha);
    },
  );

  it("draws every ink perimeter before any cream core", () => {
    const pixels = dashTrail(DASH_TRAIL, duration, frame, active);
    const firstCore = pixels.findIndex((pixel) => pixel.colour !== DASH_TRAIL.borderColour);
    expect(firstCore).toBeGreaterThan(0);
    expect(
      pixels.slice(0, firstCore).every((pixel) => pixel.colour === DASH_TRAIL.borderColour),
    ).toBe(true);
    expect(pixels.slice(firstCore).every((pixel) => pixel.colour !== DASH_TRAIL.borderColour)).toBe(
      true,
    );
  });

  it.each([
    { alpha: 255, remaining: duration },
    { alpha: 223, remaining: duration / 2 },
    { alpha: 191, remaining: duration / 10000 },
  ])(
    "keeps the first six core columns readable at remaining=$remaining",
    ({ alpha, remaining }) => {
      const pixels = dashTrail(DASH_TRAIL, duration, frame, {
        ...active,
        remainingSeconds: remaining,
      });
      for (const line of DASH_TRAIL.lines) {
        const core = pixels.filter((pixel) => pixel.y === frame.y + line.y);
        expect(core.slice(0, 6).map((pixel) => pixel.alpha)).toEqual(Array(6).fill(alpha));
      }
    },
  );

  it("shortens by actual normalized age and disappears with no post-dash tail", () => {
    const full = dashTrail(DASH_TRAIL, duration, frame, active);
    const half = dashTrail(DASH_TRAIL, duration, frame, {
      ...active,
      remainingSeconds: duration / 2,
    });
    expect(
      DASH_TRAIL.lines.map((line) => half.filter((pixel) => pixel.y === frame.y + line.y).length),
    ).toEqual([32, 24, 16]);
    expect(half.length).toBeLessThan(full.length);
    expect(half).toEqual(
      dashTrail(DASH_TRAIL, duration * 2, frame, { ...active, remainingSeconds: duration }),
    );
    expect(dashTrail(DASH_TRAIL, duration, frame, { ...active, remainingSeconds: 0 })).toEqual([]);
    expect(dashTrail(DASH_TRAIL, duration, frame, undefined)).toEqual([]);
  });
});
