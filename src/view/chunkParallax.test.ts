import { describe, expect, it } from "vitest";

import { chunkBackdropSpan, chunkParallax } from "./chunkParallax";

describe("chunk-local parallax", () => {
  const bounds = { height: 600, width: 720, x: 7200, y: 120 };

  it.each([
    { factor: 0, featureX: 200 },
    { factor: 0.4, featureX: 160 },
    { factor: 1, featureX: 100 },
  ])(
    "keeps a distant chunk visible and moves its texture at factor $factor",
    ({ factor, featureX }) => {
      const view = (x: number) =>
        chunkParallax({ parallax: { x: factor, y: 1 }, scroll: { x, y: 0 } }, bounds);
      const arrived = view(7200);
      expect(arrived.position.x - 7200).toBe(0);
      expect(arrived.textureX).toBeCloseTo(0);
      const advanced = view(7300);
      // A feature 200px into the texture moves independently of the quad's world-speed edge.
      expect(advanced.position.x - 7300 + 200 - advanced.textureX).toBe(featureX);
      expect(advanced.position.x - 7300 + bounds.width).toBe(620);
    },
  );

  it("keeps adjacent coverage edges touching while preserving authored vertical parallax", () => {
    const context = { parallax: { x: 0.4, y: 0.15 }, scroll: { x: 7300, y: 300 } };
    const left = chunkParallax(context, bounds);
    const right = chunkParallax(context, { ...bounds, x: 7920 });
    expect(left.position.x + bounds.width).toBe(right.position.x);
    expect(left.position.y - context.scroll.y).toBe(75);
    expect(left.position.y - context.scroll.y + bounds.height).toBe(675);
    expect(right.position.y).toBe(left.position.y);
  });

  it("recognizes explicit chunk spans without changing whole-area or partial scenery", () => {
    const area = { chunks: [{ width: 720, x: 7200 }], width: 8640 };
    expect(chunkBackdropSpan(area, { origin: { x: 7200, y: 0 }, width: 720 })).toEqual(
      area.chunks[0],
    );
    expect(chunkBackdropSpan(area, { origin: { x: 0, y: 0 }, width: area.width })).toBeUndefined();
    expect(chunkBackdropSpan(area, { origin: { x: 7212, y: 0 }, width: 720 })).toBeUndefined();
    expect(chunkBackdropSpan(area, { origin: { x: 7200, y: 0 }, width: 48 })).toBeUndefined();
  });
});
