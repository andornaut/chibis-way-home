import { expect, it } from "vitest";

import { scenerySpriteFrame } from "./scenerySprite.ts";

const coverage = { width: 720, x: 7200 };
const parallax = { x: 0.4, y: 0.15 };
const frame = { height: 24, width: 32, x: 7240, y: 180 };

it("anchors a small animated sprite to a distant chunk at its own parallax rate", () => {
  const start = scenerySpriteFrame({ coverage, parallax, scroll: { x: 7200, y: 0 } }, frame);
  const moved = scenerySpriteFrame({ coverage, parallax, scroll: { x: 7300, y: 300 } }, frame);
  expect(start.position.x - 7200).toBe(40);
  expect(moved.position.x - 7300).toBe(0);
  expect(moved.position.y - 300).toBe(135);
  expect(moved.crop).toEqual({ height: 24, width: 32, x: 0, y: 0 });
});

it("crops the left edge to whole source pixels without crossing into an adjacent chunk", () => {
  const view = scenerySpriteFrame(
    { coverage, parallax, scroll: { x: 7160, y: 0 } },
    { ...frame, x: 7210 },
  );
  expect(view.position.x).toBe(7186);
  expect(view.crop).toEqual({ height: 24, width: 18, x: 14, y: 0 });
  expect(view.position.x + view.crop.x).toBe(coverage.x);
  expect(view.visible).toBe(true);
});

it("clips a flying frame at the right edge and hides it once compensation leaves its chunk", () => {
  const flight = { height: 12, width: 24, x: 7896, y: 120 };
  const clipped = scenerySpriteFrame({ coverage, parallax, scroll: { x: 7220, y: 0 } }, flight);
  expect(clipped.crop.width).toBe(12);
  expect(clipped.position.x + clipped.crop.width).toBe(7920);
  const outside = scenerySpriteFrame({ coverage, parallax, scroll: { x: 7240, y: 0 } }, flight);
  expect(outside.visible).toBe(false);
  expect(outside.crop.width).toBe(0);
});

it("keeps fractional camera compensation inside the chunk without a fractional crop pixel", () => {
  const view = scenerySpriteFrame(
    { coverage, parallax, scroll: { x: 7197, y: 0 } },
    { ...frame, x: 7201 },
  );
  expect(view.crop.x).toBe(1);
  expect(Number.isInteger(view.crop.width)).toBe(true);
  expect(view.position.x + view.crop.x).toBeGreaterThanOrEqual(coverage.x);
});
