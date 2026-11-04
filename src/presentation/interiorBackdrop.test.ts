import { expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { interiorBackdrop } from "./interiorBackdrop";

const bounds = { height: 216, width: 120, x: 24, y: 48 };
const reference = { x: 100, y: 840 };
const parallax = { x: 0.8, y: 0.25 };
it.each([-10000, 10000])("keeps both clip axes fixed at extreme camera Y=%s", (y) => {
  const frame = interiorBackdrop(
    { parallax, reference, scroll: { x: 500, y }, textureTop: 0 },
    bounds,
  );
  expect(frame.position).toEqual({ x: bounds.x, y: bounds.y });
  expect(frame.position.x + bounds.width).toBe(144);
  expect(frame.position.y + bounds.height).toBe(264);
});
it("aligns separate authored bands to the native 48x144 world grid at the entry reference", () => {
  const left = interiorBackdrop({ parallax, reference, scroll: reference, textureTop: 0 }, bounds);
  const other = { ...bounds, x: 168, y: 192 };
  const right = interiorBackdrop({ parallax, reference, scroll: reference, textureTop: 0 }, other);
  expect(left.textureX % 48).toBe(right.textureX % 48);
  expect(left.textureY % 144).toBe(right.textureY % 144);
  expect(left.textureX).toBe(bounds.x);
  expect(left.textureY).toBe(bounds.y);
});
it("moves native pattern phase at the authored rates without moving or stretching the quad", () => {
  const first = interiorBackdrop({ parallax, reference, scroll: reference, textureTop: 0 }, bounds);
  const scroll = { x: reference.x + 100, y: reference.y + 100 };
  const next = interiorBackdrop({ parallax, reference, scroll, textureTop: 0 }, bounds);
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

const modulo = (value: number, period: number) => ((value % period) + period) % period;

it.each([600, 840, 1080, 1320])(
  "starts the Industrial module at world Y%s with its full header, independent of camera travel",
  (y) => {
    const art = manifest.backdrops.find(({ key }) => key === "warehouse-wall")!;
    const band = { height: Math.min(art.height, 1440 - y), width: 720, x: 720, y };
    const phases = [540, 510, 480, 540].map((cameraY) => {
      const frame = interiorBackdrop(
        {
          parallax: { x: 0.8, y: 1 },
          reference: { x: 0, y: 360 },
          scroll: { x: 720, y: cameraY },
          textureTop: art.y - art.height,
        },
        band,
      );
      expect(frame.position).toEqual({ x: band.x, y: band.y });
      return modulo(frame.textureY, art.height);
    });
    expect(phases).toEqual([0, 0, 0, 0]);
  },
);
it("preserves parent texture phase when an authored rectangle clips a partial module", () => {
  const art = manifest.backdrops.find(({ key }) => key === "warehouse-wall")!;
  const context = { parallax, reference, scroll: reference, textureTop: art.y - art.height };
  const parent = { height: art.height, width: 720, x: 720, y: 600 };
  const child = { ...parent, height: 96, y: 648 };
  const whole = interiorBackdrop(context, parent);
  const clipped = interiorBackdrop(context, child);
  expect(clipped.textureY).toBe(whole.textureY + child.y - parent.y);
  expect(modulo(clipped.textureY, art.height)).toBe(48);
  expect(clipped.position).toEqual({ x: child.x, y: child.y });
});
it.each(["apartment-wall-lobby", "apartment-far"])(
  "retains the native world-grid samples of %s at different cameras and clip rows",
  (key) => {
    const art = manifest.backdrops.find((backdrop) => backdrop.key === key)!;
    for (const y of [48, 840]) {
      for (const cameraY of [400, 840, 1100]) {
        const scroll = { x: 500, y: cameraY };
        const band = { ...bounds, y };
        const legacy = interiorBackdrop({ parallax, reference, scroll, textureTop: 0 }, band);
        const anchored = interiorBackdrop(
          { parallax, reference, scroll, textureTop: art.y - art.height },
          band,
        );
        expect(modulo(anchored.textureY, art.height)).toBe(modulo(legacy.textureY, art.height));
        expect(anchored.position).toEqual(legacy.position);
        expect(anchored.textureX).toBe(legacy.textureX);
      }
    }
  },
);
