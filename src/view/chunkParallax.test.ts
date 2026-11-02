import { describe, expect, it } from "vitest";

import { chunkBackdropSpan, chunkParallax } from "./chunkParallax";

describe("chunk-local parallax", () => {
  const bounds = { height: 600, width: 720, x: 7200, y: 120 };

  it.each([
    { factor: 0, movement: 0 },
    { factor: 0.4, movement: -40 },
    { factor: 1, movement: -100 },
  ])(
    "keeps a distant chunk visible and moves its texture at factor $factor",
    ({ factor, movement }) => {
      const view = (x: number) =>
        chunkParallax({ parallax: { x: factor, y: 1 }, scroll: { x, y: 0 } }, bounds);
      const arrived = view(7200);
      expect(arrived.position.x - 7200).toBe(0);
      const advanced = view(7300);
      const before = arrived.position.x - 7200 + 200 - arrived.textureX;
      const after = advanced.position.x - 7300 + 200 - advanced.textureX;
      expect(after - before).toBeCloseTo(movement);
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

  it.each([
    { factor: 0.15, period: 720, widths: [720, 720, 720] },
    { factor: 0.4, period: 720, widths: [480, 960, 720] },
  ])(
    "keeps neighbouring edge pixels continuous for native period $period and rate $factor",
    ({ factor, period, widths }) => {
      const wrap = (value: number) => ((value % period) + period) % period;
      const sampled = (frame: ReturnType<typeof chunkParallax>, worldX: number) =>
        wrap(worldX - frame.position.x + frame.textureX);
      let x = 0;
      const spans = widths.map((width) => {
        const span = { ...bounds, width, x };
        x += width;
        return span;
      });
      for (const cameraX of [0, 360, 1440, 720, 0]) {
        const context = { parallax: { x: factor, y: 0.05 }, scroll: { x: cameraX, y: 360 } };
        const whole = chunkParallax(context, { ...bounds, width: x, x: 0 });
        const frames = spans.map((span) => chunkParallax(context, span));
        spans.forEach((span, index) => {
          const frame = frames[index]!;
          const sampleX = span.x + span.width / 2;
          expect(sampled(frame, sampleX)).toBeCloseTo(sampled(whole, sampleX));
          const next = frames[index + 1];
          if (next) {
            const edge = span.x + span.width;
            expect(wrap(sampled(frame, edge - 1) + 1)).toBeCloseTo(sampled(next, edge));
          }
        });
      }
    },
  );

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
