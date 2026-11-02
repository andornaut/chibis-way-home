import { expect, it } from "vitest";

import { CAMERA } from "../data/camera";
import { backgroundGroundOffset } from "./backgroundGround";
import { chunkParallax } from "./chunkParallax";

const screen = { height: 360, width: 720 };
const area = {
  chunks: [
    { width: 720, x: 0 },
    { width: 720, x: 720 },
  ],
  entries: { start: { x: 24, y: 600 } },
  height: 720,
  solids: [
    { height: 120, width: 720, x: 0, y: 600 },
    { height: 240, width: 720, x: 720, y: 480 },
  ],
  width: 1440,
};
const context = { area, camera: CAMERA, screen };

it.each([0.05, 0.15, 1])(
  "anchors the art bottom while retaining vertical rate %s and horizontal clipping",
  (y) => {
    const offset = backgroundGroundOffset(context, {
      groundAnchor: "start",
      height: 600,
      parallax: { x: 0.4, y },
    });
    const bounds = { height: 600, width: 720, x: 720, y: 12 + offset };
    const frame = (scrollY: number) =>
      chunkParallax({ parallax: { x: 0.4, y }, scroll: { x: 800, y: scrollY } }, bounds);
    expect(frame(360).position.y - 360 + 600).toBeCloseTo(252);
    expect(frame(180).position.y - 180 + 600).toBeCloseTo(252 + y * 180);
    expect(frame(180).position.x).toBe(720);
    expect(frame(180).textureX).toBe(240);
  },
);
it("keeps a 600px mid layer's visible band above the industrial foreground", () => {
  const offset = backgroundGroundOffset(context, {
    groundAnchor: "start",
    height: 600,
    parallax: { x: 0.4, y: 0.15 },
  });
  expect(406 + offset - 0.15 * 180).toBeCloseTo(73);
});
it("preserves unanchored authored layers and rejects missing reference entries", () => {
  expect(backgroundGroundOffset(context, { height: 600 })).toBe(0);
  expect(() => backgroundGroundOffset(context, { groundAnchor: "absent", height: 600 })).toThrow(
    /entry absent/,
  );
});
it("uses the existing camera bounds when an entry ground cannot rest at the preferred screen height", () => {
  const bounded = { ...area, height: 360, solids: [{ height: 60, width: 1440, x: 0, y: 300 }] };
  expect(
    backgroundGroundOffset(
      { ...context, area: bounded },
      { groundAnchor: "start", height: 600, parallax: { x: 0.4, y: 0.15 } },
    ),
  ).toBe(-300);
});
