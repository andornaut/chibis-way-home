/**
 * Naturalistic background forms: irregular leaf masses, tapered branches and species silhouettes.
 *
 * Shared by environment tools. Pixel clusters are quantized to at least 2px at foliage scale; no
 * contour pass.
 */

import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as pixel from "./pixel.ts";

type Point = readonly [number, number];

// CLEANUP (added 2026-11-04): replace with @andornaut/art-kit/draw once 0.12.0 is pinned
function fillPolygon(rgba: readonly number[], points: readonly Point[], image: RgbaImage): void {
  throw new Error(
    `pending art-kit draw: a ${points.length}-point polygon in rgba ${rgba.join(",")} ` +
      `on a ${image.width}x${image.height} image`,
  );
}

export function polygon(im: RgbaImage, colour: string, points: readonly Point[]): void {
  fillPolygon([...pixel.rgb(colour), 255], points, im);
}

/** Distance from the origin, as sqrt of the sum of squares rather than Math.hypot. */
function length(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

export function branch(
  im: RgbaImage,
  colour: string,
  start: Point,
  end: Point,
  width: number,
): void {
  const [x, y] = start;
  const [ex, ey] = end;
  const dx = ex - x;
  const dy = ey - y;
  const span = Math.max(1, length(dx, dy));
  const nx = -dy / span;
  const ny = dx / span;
  polygon(im, colour, [
    [x + (nx * width) / 2, y + (ny * width) / 2],
    [ex + (nx * width) / 5, ey + (ny * width) / 5],
    [ex - (nx * width) / 5, ey - (ny * width) / 5],
    [x - (nx * width) / 2, y - (ny * width) / 2],
  ]);
}

const RADII = [0.88, 1.0, 0.92, 1.04, 0.86, 0.98, 1.02, 0.9, 1.0, 0.94, 0.84, 1.02];

export function leaves(
  im: RgbaImage,
  colour: string,
  box: readonly [x: number, y: number, width: number, height: number],
  seed = 0,
): void {
  const [x, y, width, height] = box;
  const points: Point[] = [];
  const step = width < 80 ? 2 : 4;
  for (let i = 0; i < 36; i++) {
    const angle = (i * 2 * Math.PI) / 36;
    const radius = RADII[(i + seed) % RADII.length] as number;
    const px = x + width / 2 + ((Math.cos(angle) * width) / 2) * radius;
    const py = y + height / 2 + ((Math.sin(angle) * height) / 2) * radius;
    points.push([pixel.round(px / step) * step, pixel.round(py / step) * step]);
  }
  polygon(im, colour, points);
}

export function broadleaf(
  im: RgbaImage,
  x: number,
  top: number,
  width: number,
  height: number,
  bottom: number,
  leaf: string,
  wood: string,
  trunkWidth: number,
  seed = 0,
): void {
  const centre = x + width * 0.52;
  const fork: Point = [centre - width * 0.04, top + height * 0.78];
  branch(im, wood, [centre + width * 0.025, bottom], fork, trunkWidth);
  for (const [dx, dy] of [
    [0.18, 0.48],
    [0.78, 0.34],
    [0.48, 0.18],
  ] as const)
    branch(im, wood, fork, [x + width * dx, top + height * dy], trunkWidth * 0.58);
  for (const [dx, dy, w, h, phase] of [
    [0.04, 0.22, 0.64, 0.57, 0],
    [0.38, 0.1, 0.6, 0.57, 3],
    [0.2, 0.0, 0.57, 0.53, 6],
    [0.2, 0.42, 0.62, 0.43, 9],
  ] as const)
    leaves(im, leaf, [x + width * dx, top + height * dy, width * w, height * h], seed + phase);
}

export function spruce(
  im: RgbaImage,
  x: number,
  top: number,
  width: number,
  height: number,
  bottom: number,
  leaf: string,
  wood: string,
  seed = 0,
): void {
  const centre = x + width * 0.51;
  branch(im, wood, [centre, bottom], [centre - 2, top + 8], Math.max(4, width * 0.065));
  const left: Point[] = [[centre, top]];
  const right: Point[] = [];
  // Irregular drooping bough tiers build one connected tapered crown, rather than stacked triangles.
  for (let i = 1; i < 12; i++) {
    const yy = top + (height * i) / 12;
    const spread = width * (0.08 + i / 26) * (0.9 + ((i + seed) % 3) * 0.07);
    left.push([centre - spread * 0.6, yy - height * 0.05], [centre - spread, yy + height * 0.035]);
    right.unshift(
      [centre + spread * 0.9, yy + height * 0.01],
      [centre + spread * 0.57, yy - height * 0.06],
    );
  }
  polygon(im, leaf, [
    ...left,
    [centre - width * 0.2, top + height],
    [centre + width * 0.17, top + height],
    ...right,
  ]);
}
