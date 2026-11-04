/**
 * Game palettes and art export policy over art-kit mechanisms. Run art scripts from the
 * repository root with Node's native type stripping: node art/tools/<tool>.ts build.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { contrast as hexContrast, rgb as hexRgb } from "@andornaut/art-kit/colour";
import { flipped as flipFrame, type Frame, Grid as SharedGrid } from "@andornaut/art-kit/grid";
import { encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/png";
import {
  composeContactSheet,
  composeSheet,
  type Tag as SpriteSheetTag,
} from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";

import * as backgroundPalette from "./backgroundPalette.ts";
import { commands } from "./cli.ts";
import * as zoneThemes from "./zoneThemes.ts";

export type { Frame, SpriteSheetTag };
/** [tag, frames, milliseconds per frame or one duration per frame]. */
export type Tags = readonly SpriteSheetTag[];
/** [sprite key, tags]. */
export type SpriteEntry = readonly [key: string, tags: Tags];
export type Margins = readonly [left: number, top: number, right: number, bottom: number];
export type HitboxTuple = readonly [x: number, y: number, width: number, height: number];
export interface Hitbox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ManifestEntry {
  key: string;
  [field: string]: unknown;
}
type Manifest = Record<string, ManifestEntry[] | unknown>;

// Endesga 32, by role.
export const K: Record<string, string> = {
  rust: "be4a2f",
  ochre: "d77643",
  cream: "ead4aa",
  tan: "e4a672",
  brown: "b86f50",
  dbrown: "733e39",
  plum: "3e2731",
  dred: "a22633",
  red: "e43b44",
  orange: "f77622",
  amber: "feae34",
  yellow: "fee761",
  green: "63c74d",
  dgreen: "3e8948",
  forest: "265c42",
  teal: "193c3e",
  blue: "124e89",
  sky: "0099db",
  cyan: "2ce8f5",
  white: "ffffff",
  lgrey: "c0cbdc",
  grey: "8b9bb4",
  slate: "5a6988",
  dslate: "3a4466",
  navy: "262b44",
  ink: "181425",
  hot: "ff0044",
  purple: "68386c",
  mauve: "b55088",
  pink: "f6757a",
  skin1: "e8b796",
  skin2: "c28569",
};
Object.assign(K, zoneThemes.colours());
Object.assign(K, backgroundPalette.colours(K));
K["warning-red"] = "d45253";
export const PALETTE: string[] = Object.values(K);
// One ramp step darker for each colour. Shadows and dimming step down this, never blend with black.
const DARKER: Record<string, string> = Object.fromEntries(
  [
    "be4a2f:733e39",
    "d77643:be4a2f",
    "ead4aa:e4a672",
    "e4a672:b86f50",
    "b86f50:733e39",
    "733e39:3e2731",
    "3e2731:181425",
    "a22633:3e2731",
    "e43b44:a22633",
    "d45253:a22633",
    "f77622:be4a2f",
    "feae34:f77622",
    "fee761:feae34",
    "63c74d:3e8948",
    "3e8948:265c42",
    "265c42:193c3e",
    "193c3e:181425",
    "124e89:262b44",
    "0099db:124e89",
    "2ce8f5:0099db",
    "ffffff:c0cbdc",
    "c0cbdc:8b9bb4",
    "8b9bb4:5a6988",
    "5a6988:3a4466",
    "3a4466:262b44",
    "262b44:181425",
    "181425:181425",
    "ff0044:a22633",
    "68386c:3e2731",
    "b55088:68386c",
    "f6757a:b55088",
    "e8b796:c28569",
    "c28569:b86f50",
  ].map((pair) => pair.split(":")),
);
Object.assign(DARKER, zoneThemes.ramps(K));
Object.assign(DARKER, backgroundPalette.ramps(DARKER, K));

export const MANIFEST = "public/art/manifest.json";
export const SPRITES = "public/art/sprites";
export const TILESETS = "public/art/tilesets";
const DEFAULT_GROUNDS = ["5a6988", "e4a672", "ead4aa"] as const;

/** The hex value of a K name; an unknown name fails the build. */
export function hex(name: string): string {
  const value = K[name];
  if (value === undefined) {
    throw new Error(`Unknown palette colour: ${name}`);
  }
  return value;
}

/** A K name or hex string as hex. */
export function hexc(c: string): string {
  return Object.hasOwn(K, c) ? (K[c] as string) : c;
}

export function rgb(c: string): [number, number, number] {
  return hexRgb(hexc(c));
}

/** c stepped down its ramp. */
export function darker(c: string, steps = 1): string {
  let colour = hexc(c);
  for (let i = 0; i < steps; i++) {
    if (!Object.hasOwn(DARKER, colour)) {
      throw new Error(`No darker ramp step for ${colour}`);
    }
    colour = DARKER[colour] as string;
  }
  return colour;
}

/** WCAG contrast ratio of two local palette colours. */
export function contrast(a: string, b: string): number {
  return hexContrast(hexc(a), hexc(b));
}

/** The shared grid bound to the game palette and its two-step outline. */
export class Grid extends SharedGrid {
  constructor(w = 32, h = 32) {
    super(K, w, h, { edge: (colour) => darker(colour, 2) });
  }
}

export const flipped = (frame: Frame): Frame => flipFrame(frame);

/** The nearest integer, with ties rounded to the even neighbour. */
export function round(value: number): number {
  return Math.abs(value % 1) === 0.5 ? 2 * Math.round(value / 2) : Math.round(value);
}

/** The floor-modulo remainder: it takes the divisor's sign. */
export function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedKeys);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, item]) => [key, sortedKeys(item)]));
  }
  return value;
}

/**
 * value as two-space indented JSON, keys sorted when sortKeys is set, plus a final newline:
 * non-ASCII characters escape as lower-case \uXXXX. Integer-like object keys enumerate first in
 * JavaScript, ahead of the other keys.
 */
export function dumpJson({ sortKeys = false }: { sortKeys?: boolean }, value: unknown): string {
  const text = JSON.stringify(sortKeys ? sortedKeys(value) : value, null, 2);
  return `${text.replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`;
}

/** Write dumpJson output, creating the parent directory. */
export function writeJson(options: { sortKeys?: boolean }, path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, dumpJson(options, value));
}

export function readManifest(): Manifest {
  return existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest) : {};
}

function sortedByKey<T extends { key: string }>(entries: Iterable<T>): T[] {
  return [...entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * Merge entries (objects with a "key") into the manifest's section (tilesets, backdrops):
 * replace those with the same key, keep every other entry, sort by key. Each tool owns its own
 * keys, so several tools can share a section; a tool that stops drawing a piece removes its entry
 * by hand.
 */
export function updateManifest(section: string, entries: readonly ManifestEntry[]): void {
  const manifest = readManifest();
  const merged = new Map<string, ManifestEntry>();
  for (const entry of (manifest[section] as ManifestEntry[] | undefined) ?? []) {
    merged.set(entry.key, entry);
  }
  for (const entry of entries) {
    merged.set(entry.key, entry);
  }
  manifest[section] = sortedByKey(merged.values());
  writeJson({}, MANIFEST, manifest);
}

interface TilesetOptions {
  key: string;
  /** A piece name to rows of tile names, top row first. */
  pieces?: Readonly<Record<string, readonly (readonly string[])[]>>;
  /** A hazard tile's hit box in pixels within its tile; omitted tiles hit their whole cell. */
  hitboxes?: Readonly<Record<string, Hitbox>>;
  size?: number;
  columns?: number;
}

/**
 * Write a tileset: public/art/tilesets/<key>.png, size x size tiles in rows of columns with no
 * spacing or margin, and <key>.json beside it, keys sorted:
 *   {"tileSize": size, "columns": columns,
 *    "tiles": {"<name>": <index>},                 index = row * columns + column
 *    "pieces": {"<name>": [[<index>, ...], ...]},  multi-tile pieces, rows of indices
 *    "hitboxes": {"<name>": {"x", "y", "width", "height"}}}  only when some tile has one
 * items lists [name, size x size image]. Returns the manifest entry.
 */
export async function writeTileset(
  { columns = 8, hitboxes, key, pieces = {}, size = 12 }: TilesetOptions,
  items: readonly (readonly [name: string, tile: RgbaImage])[],
): Promise<ManifestEntry> {
  mkdirSync(TILESETS, { recursive: true });
  const sheet = composeSheet(
    { columns, cellWidth: size, cellHeight: size },
    items.map(([, tile]) => tile),
  );
  writeFileSync(`${TILESETS}/${key}.png`, encodeRgbaPng(SHEET_PNG, sheet));
  const index: Record<string, number> = {};
  items.forEach(([name], i) => {
    index[name] = i;
  });
  const indexOf = (name: string): number => {
    if (!Object.hasOwn(index, name)) {
      throw new Error(`${key}: piece names unknown tile ${name}`);
    }
    return index[name] as number;
  };
  const data: Record<string, unknown> = {
    columns,
    pieces: Object.fromEntries(
      Object.entries(pieces).map(([name, rows]) => [name, rows.map((row) => row.map(indexOf))]),
    ),
    tileSize: size,
    tiles: index,
  };
  if (hitboxes && Object.keys(hitboxes).length) {
    const unknown = Object.keys(hitboxes)
      .filter((name) => !Object.hasOwn(index, name))
      .sort();
    if (unknown.length) {
      throw new Error(`${key}: hit boxes for tiles it does not have: ${unknown.join(", ")}`);
    }
    data.hitboxes = hitboxes;
  }
  writeJson({ sortKeys: true }, `${TILESETS}/${key}.json`, data);
  return { key, png: `tilesets/${key}.png`, json: `tilesets/${key}.json` };
}

const SHEET_PNG = { deflateLevel: 9, deflateStrategy: 3, filterType: -1 };

interface PreviewOptions {
  out: string;
  grounds?: readonly string[];
  scale?: number;
  gap?: number;
}

/** Contact sheet: one row per sprite and ground colour, every frame in tag order. */
export async function preview(
  { gap = 4, grounds = DEFAULT_GROUNDS, out, scale = 3 }: PreviewOptions,
  sprites: readonly SpriteEntry[],
): Promise<void> {
  const sheet = composeContactSheet(
    { resolveRgb: rgb, background: rgb("ink"), cellSize: "largest-frame", scale, gap },
    sprites,
    grounds,
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodeRgbPng(SHEET_PNG, sheet));
}

interface BuildOptions {
  /** Nine-slice margins by key, exported as a sheet slice named after the key. */
  slices?: Readonly<Record<string, Margins>>;
  /** Tags that play once and hold their last frame, by key; every other tag loops. */
  once?: Readonly<Record<string, readonly string[]>>;
  /** Hit boxes in frame pixels by key, for the facing the sprite is drawn in. */
  hitboxes?: Readonly<Record<string, HitboxTuple>>;
  /** Body sprite keys opted into silhouette contact; refreshes the shared export. */
  contacts?: readonly string[];
}

/**
 * Write every sprite's sheet to public/art/sprites/<key>.png and its json-hash data with tags to
 * <key>.json, and list it in the manifest. Every manifest entry carries "once" in tag
 * order, [] when nothing plays once; "slice", "contact" and "hitbox" only when declared. A hit box
 * outside the frame fails the build.
 */
export async function build(
  { contacts = [], hitboxes = {}, once = {}, slices = {} }: BuildOptions,
  sprites: readonly SpriteEntry[],
): Promise<void> {
  const keys = new Set(sprites.map(([key]) => key));
  const unknownContacts = contacts.filter((key) => !keys.has(key)).sort();
  if (unknownContacts.length) {
    throw new Error(`Unknown contact sprites: ${unknownContacts.join(", ")}`);
  }
  for (const [key, tags] of sprites) {
    const tagNames = new Set(tags.map(([tag]) => tag));
    const unknown = (once[key] ?? []).filter((tag) => !tagNames.has(tag)).sort();
    if (unknown.length) {
      throw new Error(`${key}: once names tags it does not have: ${unknown.join(", ")}`);
    }
    const box = hitboxes[key];
    if (box) {
      const [x, y, w, h] = box;
      const frame = tags[0]?.[1][0];
      const fh = frame?.length ?? 0;
      const fw = frame?.[0]?.length ?? 0;
      if (!(w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= fw && y + h <= fh)) {
        throw new Error(`${key}: hitbox ${box.join(", ")} is not inside its ${fw}x${fh} frame`);
      }
    }
  }
  const unknownHitboxes = Object.keys(hitboxes)
    .filter((key) => !keys.has(key))
    .sort();
  if (unknownHitboxes.length) {
    throw new Error(
      `hitboxes name sprites the script does not draw: ${unknownHitboxes.join(", ")}`,
    );
  }
  const built = new Map<string, string[]>();
  // One sheet at a time, in sprite order.
  await sprites.reduce(async (previous, [key, tags]) => {
    await previous;
    const margins = slices[key];
    await writeSpriteSheet(
      { sheet: `${SPRITES}/${key}.png`, data: `${SPRITES}/${key}.json` },
      margins ? { key, margins } : { key },
      tags,
    );
    const playOnce = once[key] ?? [];
    built.set(
      key,
      tags.map(([tag]) => tag).filter((tag) => playOnce.includes(tag)),
    );
  }, Promise.resolve());
  const manifest = readManifest();
  const entries = new Map<string, ManifestEntry>();
  for (const entry of (manifest.sprites as ManifestEntry[] | undefined) ?? []) {
    entries.set(entry.key, entry);
  }
  for (const [key, onceTags] of built) {
    const entry: ManifestEntry = {
      key,
      png: `sprites/${key}.png`,
      json: `sprites/${key}.json`,
      once: onceTags,
    };
    const margins = slices[key];
    if (margins) {
      const [left, top, right, bottom] = margins;
      entry.slice = { left, top, right, bottom };
    }
    if (contacts.includes(key)) {
      entry.contact = "silhouette";
    }
    const box = hitboxes[key];
    if (box) {
      const [x, y, width, height] = box;
      entry.hitbox = { x, y, width, height };
    }
    entries.set(key, entry);
  }
  manifest.sprites = sortedByKey(entries.values());
  writeJson({}, MANIFEST, manifest);
  if (contacts.length) {
    // Loaded by name: contact silhouettes read the sprites this build has just exported.
    const contactModule = "./contactSilhouettes.ts";
    const contactSilhouettes = (await import(contactModule)) as { build: () => Promise<void> };
    await contactSilhouettes.build();
  }
  console.log("built", [...built.keys()].join(", "));
}

export interface MainOptions extends BuildOptions {
  /** The usage, printed for help and with a usage error. */
  usage: string;
  grounds?: readonly string[];
}

/**
 * The command line every art script shares: `build`, or `preview OUT.png`. argv excludes the
 * Node executable and script, as process.argv.slice(2).
 */
export async function main(
  { grounds = DEFAULT_GROUNDS, usage, ...buildOptions }: MainOptions,
  sprites: () => Iterable<SpriteEntry>,
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  await commands(
    {
      usage,
      build: () => build(buildOptions, [...sprites()]),
      preview: (out) => preview({ out, grounds }, [...sprites()]),
    },
    argv,
  );
}
