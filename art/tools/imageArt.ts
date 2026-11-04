/**
 * RGBA image helpers shared by the backdrop and tileset generators, over art-kit's raster and draw
 * modules. A Box is [x0, y0, x1, y1) with exclusive right and bottom edges for rect and cropBox;
 * ellipse and rectangle treat it as inclusive bounds.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import * as draw from "@andornaut/art-kit/draw";
import { decodePng, encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/png";
import {
  composite,
  crop,
  fill,
  filledImage,
  frameToRgba,
  grayscale,
  opaque,
  type Rgba,
} from "@andornaut/art-kit/raster";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as pixel from "./pixel.ts";

export type { RgbaImage };
export type XY = readonly [x: number, y: number];
export type Box = readonly [x0: number, y0: number, x1: number, y1: number];

const PNG_OPTIONS = { deflateLevel: 9, deflateStrategy: 0, filterType: -1 };

/** An opaque palette colour (a K name or hex string). */
export function rgba(colour: string): Rgba {
  return [...pixel.rgb(colour), 255];
}

const points = (xy: readonly XY[]) => xy.map(([x, y]) => ({ x, y }));

/** A width x height image filled with colour, or clear without one. */
export function image(width: number, height: number, colour?: string): RgbaImage {
  return colour ? filledImage(rgba(colour), width, height) : blankImage(width, height);
}

/** Replace the box's pixels with colour, clipped; null clears them. */
export function rect(colour: string | null, [x0, y0, x1, y1]: Box, target: RgbaImage): void {
  const value: Rgba = colour === null ? [0, 0, 0, 0] : rgba(colour);
  fill({ rect: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } }, value, target);
}

/** Fill the polygon through vertices with colour, with an optional outline colour. */
export function polygon(
  { colour, outline }: { colour: string; outline?: string },
  vertices: readonly XY[],
  target: RgbaImage,
): void {
  const style = outline ? { fill: rgba(colour), outline: rgba(outline) } : { fill: rgba(colour) };
  draw.polygon(style, points(vertices), target);
}

/** Draw a polyline through xy in colour, width pixels wide. */
export function line(
  { colour, width = 1 }: { colour: string; width?: number },
  xy: readonly XY[],
  target: RgbaImage,
): void {
  draw.line({ fill: rgba(colour), width }, points(xy), target);
}

/** Fill the ellipse inscribed in the inclusive box with colour. */
export function ellipse(colour: string, [x0, y0, x1, y1]: Box, target: RgbaImage): void {
  draw.ellipse({ fill: rgba(colour) }, { x0, y0, x1, y1 }, target);
}

/** Fill the inclusive box with colour. */
export function rectangle(colour: string, [x0, y0, x1, y1]: Box, target: RgbaImage): void {
  draw.rectangle({ fill: rgba(colour) }, { x0, y0, x1, y1 }, target);
}

/** The box cut from source; pixels outside the source are clear. */
export function cropBox([x0, y0, x1, y1]: Box, source: RgbaImage): RgbaImage {
  return crop({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, source);
}

/** Alpha-composite source over target with its top-left at at. */
export function over(at: XY, source: RgbaImage, target: RgbaImage): void {
  composite({ x: at[0], y: at[1] }, source, target);
}

/** A PNG decoded as RGBA. */
export function readImage(path: string): RgbaImage {
  return decodePng(readFileSync(path));
}

/** Save an RGBA PNG, creating the parent directory. */
export function writeImage(path: string, source: RgbaImage): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodeRgbaPng(PNG_OPTIONS, source));
}

/** Save an opaque RGB PNG, dropping alpha, creating the parent directory. */
export function writeRgbImage(path: string, source: RgbaImage): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodeRgbPng(PNG_OPTIONS, opaque(source)));
}

/** A palette frame as an image, with clear pixels where the frame has none. */
export function frameImage(px: pixel.Frame): RgbaImage {
  return frameToRgba({ resolveRgb: pixel.rgb }, px);
}

/** ITU-R 601-2 luma of each pixel as an opaque grey image, for an RGB save. */
export function greyscale(source: RgbaImage): RgbaImage {
  const plane = grayscale(source);
  const grey = filledImage([0, 0, 0, 255], plane.width, plane.height);
  plane.data.forEach((level, i) => grey.data.set([level, level, level], i * 4));
  return grey;
}

/** The first frame of an exported sprite sheet, public/art/sprites/<key>.png. */
export function spriteFrame(key: string): RgbaImage {
  const path = `${pixel.SPRITES}/${key}`;
  const data = JSON.parse(readFileSync(`${path}.json`, "utf8")) as {
    frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  };
  const first = Object.values(data.frames)[0];
  if (!first) {
    throw new Error(`${key}: sprite sheet has no frames`);
  }
  const { h, w, x, y } = first.frame;
  return cropBox([x, y, x + w, y + h], readImage(`${path}.png`));
}

/** Suffixes of a terrain block's tile at column x, row y of a width-wide block. */
function terrainSuffix(x: number, y: number, width: number): string {
  if (y === 0) {
    return x === 0 ? "top-left" : x === width - 1 ? "top-right" : x % 2 ? "top-joint" : "top";
  }
  return x === 0 ? "face-left" : x === width - 1 ? "face-right" : "face";
}

/** A width x height block of a terrain family's tiles at tile column col, row row. */
export function terrainBlock(
  {
    col,
    family,
    height,
    row,
    size = 12,
    tiles,
    width,
  }: {
    tiles: ReadonlyMap<string, RgbaImage>;
    family: string;
    col: number;
    row: number;
    width: number;
    height: number;
    size?: number;
  },
  target: RgbaImage,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles.get(`${family}-${terrainSuffix(x, y, width)}`);
      if (!tile) {
        throw new Error(`no tile ${family}-${terrainSuffix(x, y, width)}`);
      }
      over([(col + x) * size, (row + y) * size], tile, target);
    }
  }
}

/**
 * The common skin comparison foreground: ground and three raised blocks, shared one-way ledges and
 * a hazard strip from tiles-platforming, and the bird at x 72, y 558. Illustrative geometry only.
 */
export function skinForeground(
  {
    ground,
    raised,
    tiles,
  }: { tiles: ReadonlyMap<string, RgbaImage>; ground: string; raised: string },
  target: RgbaImage,
): void {
  const T = 12;
  terrainBlock({ tiles, family: ground, col: 0, row: 50, width: 60, height: 10 }, target);
  for (const [col, row, width, height] of [
    [20, 46, 6, 4],
    [31, 42, 7, 8],
    [44, 38, 7, 12],
  ] as const) {
    terrainBlock({ tiles, family: raised, col, row, width, height }, target);
  }
  // Shared standable ledges and contact strips are loaded, not copied into the material pack.
  const shared = JSON.parse(readFileSync(`${pixel.TILESETS}/tiles-platforming.json`, "utf8")) as {
    tiles: Record<string, number>;
  };
  const sharedPng = readImage(`${pixel.TILESETS}/tiles-platforming.png`);
  const sharedTile = (name: string): RgbaImage => {
    const i = shared.tiles[name];
    if (i === undefined) {
      throw new Error(`tiles-platforming has no ${name}`);
    }
    const x = (i % 8) * T;
    const y = Math.floor(i / 8) * T;
    return cropBox([x, y, x + T, y + T], sharedPng);
  };
  for (let c = 12; c < 18; c++) {
    const name =
      c === 12 ? "one-way-ledge-left" : c === 17 ? "one-way-ledge-right" : "one-way-ledge-middle";
    over([c * T, 44 * T], sharedTile(name), target);
  }
  for (let c = 31; c < 38; c++) {
    over([38 * T, (42 + c - 31) * T], sharedTile("hazard-right"), target);
  }
  over([72, 558], spriteFrame("bird"), target);
}

interface BackdropEntry extends pixel.ManifestEntry {
  png: string;
  width: number;
  height: number;
  anchor: "bottom-left";
  y: number;
  repeat: string;
}

/** A bottom-left anchored backdrop manifest entry. */
export function backdropEntry(
  { bottom, repeat }: { bottom: number; repeat: string },
  key: string,
  source: RgbaImage,
): BackdropEntry {
  return {
    key,
    png: `backdrops/${key}.png`,
    width: source.width,
    height: source.height,
    anchor: "bottom-left",
    y: bottom,
    repeat,
  };
}

export const BACKDROPS_DIR = "public/art/backdrops";
