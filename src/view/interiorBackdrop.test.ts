import { expect, it } from "vitest";

import { interiorBackdrop } from "./interiorBackdrop";

const bounds = { height: 216, width: 120, x: 24, y: 48 };
const reference = { x: 100, y: 840 };
const parallax = { x: 0.8, y: 0.25 };
it.each([-10000, 10000])("keeps both clip axes fixed at extreme camera Y=%s", (y) => {
  const frame = interiorBackdrop({ parallax, reference, scroll: { x: 500, y } }, bounds);
  expect(frame.position).toEqual({ x: bounds.x, y: bounds.y });
  expect(frame.position.x + bounds.width).toBe(144);
  expect(frame.position.y + bounds.height).toBe(264);
});
it("aligns separate authored bands to the native 48x144 world grid at the entry reference", () => {
  const left = interiorBackdrop({ parallax, reference, scroll: reference }, bounds);
  const other = { ...bounds, x: 168, y: 192 };
  const right = interiorBackdrop({ parallax, reference, scroll: reference }, other);
  expect(left.textureX % 48).toBe(right.textureX % 48);
  expect(left.textureY % 144).toBe(right.textureY % 144);
  expect(left.textureX).toBe(bounds.x);
  expect(left.textureY).toBe(bounds.y);
});
it("moves native pattern phase at the authored rates without moving or stretching the quad", () => {
  const first = interiorBackdrop({ parallax, reference, scroll: reference }, bounds);
  const scroll = { x: reference.x + 100, y: reference.y + 100 };
  const next = interiorBackdrop({ parallax, reference, scroll }, bounds);
  const screenFeature = (frame: typeof first, camera: typeof scroll) => ({
    x: frame.position.x - camera.x - frame.textureX,
    y: frame.position.y - camera.y - frame.textureY,
  });
  const before = screenFeature(first, reference);
  const after = screenFeature(next, scroll);
  expect(after.x - before.x).toBeCloseTo(-80);
  expect(after.y - before.y).toBeCloseTo(-25);
  expect(next.position).toEqual(first.position);
});
