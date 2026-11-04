/**
 * Export exact opaque sprite contact as sparse horizontal pixel runs from final PNG exports.
 *
 * Usage: node art/tools/contactSilhouettes.ts build, from the repository root.
 * Only manifest sprites explicitly marked contact='silhouette' participate. Each exact sheet
 * frame name maps to sorted [y,left,rightExclusive] runs in the full untrimmed frame. Adjacent
 * pixels form one run. Alpha greater than zero is occupied; partial alpha is rejected. Coloured
 * outlines are part of the body. Portraits, projectiles, traps and separate effects are excluded by
 * their absence of the contact marker. No pixels, frames, tags, timings, anchors or physical reach
 * boxes are changed by this export.
 */

import { readFileSync, writeFileSync } from "node:fs";

import { decodePng } from "@andornaut/art-kit/png";
import { channel, crop } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import * as pixel from "./pixel.ts";

export const OUT = "public/art/contact-silhouettes.json";
const USAGE = "Usage: contactSilhouettes.ts build";

type Run = [y: number, left: number, rightExclusive: number];
interface Size {
  w: number;
  h: number;
}
interface ExportFrame {
  frame: { x: number; y: number; w: number; h: number };
  trimmed: boolean;
  rotated: boolean;
  sourceSize: Size;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
}

function check(condition: boolean, message = "Assertion failed"): void {
  if (!condition) {
    throw new Error(message);
  }
}

/** Full-frame rows, top to bottom; intervals are half open and merged left to right. */
function occupiedRuns(im: RgbaImage): Run[] {
  const alpha = channel(3, im);
  check(
    alpha.data.every((value) => value === 0 || value === 255),
    "Contact art must have binary alpha",
  );
  const runs: Run[] = [];
  for (let y = 0; y < im.height; y++) {
    let left: number | null = null;
    for (let x = 0; x <= im.width; x++) {
      const occupied = x < im.width && (alpha.data[y * im.width + x] as number) > 0;
      if (occupied && left === null) {
        left = x;
      } else if (!occupied && left !== null) {
        runs.push([y, left, x]);
        left = null;
      }
    }
  }
  return runs;
}

/** Read final exported frame rectangles, retaining exact frame names and untrimmed coordinates. */
function spriteMasks(entry: pixel.ManifestEntry): {
  width: number;
  height: number;
  frames: Record<string, Run[]>;
} {
  const data = JSON.parse(readFileSync(`public/art/${String(entry.json)}`, "utf8")) as {
    frames: Record<string, ExportFrame>;
  };
  const sheet = decodePng(readFileSync(`public/art/${String(entry.png)}`));
  const frames: Record<string, Run[]> = {};
  let size: [number, number] | null = null;
  check(Object.keys(data.frames).length > 0, `${entry.key}: no exported frames`);
  for (const [name, frame] of Object.entries(data.frames)) {
    const rect = frame.frame;
    const current: [number, number] = [rect.w, rect.h];
    check(!frame.trimmed && !frame.rotated, `${name}: contact requires untrimmed frames`);
    check(
      frame.sourceSize.w === current[0] &&
        frame.sourceSize.h === current[1] &&
        Object.keys(frame.sourceSize).length === 2,
      `${name}: source size mismatch`,
    );
    const source = frame.spriteSourceSize;
    check(
      source.x === 0 &&
        source.y === 0 &&
        source.w === current[0] &&
        source.h === current[1] &&
        Object.keys(source).length === 4,
    );
    check(
      size === null || (current[0] === size[0] && current[1] === size[1]),
      `${name}: inconsistent frame size`,
    );
    size = current;
    const { x, y } = rect;
    check(x >= 0);
    check(y >= 0);
    check(x + size[0] <= sheet.width);
    check(y + size[1] <= sheet.height);
    frames[name] = occupiedRuns(crop({ height: size[1], width: size[0], x, y }, sheet));
  }
  const [width, height] = size as [number, number];
  return { width, height, frames };
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

export function build(): void {
  const manifest = JSON.parse(readFileSync(pixel.MANIFEST, "utf8")) as {
    sprites: pixel.ManifestEntry[];
  };
  const sprites = Object.fromEntries(
    manifest.sprites
      .filter((entry) => entry.contact === "silhouette")
      .map((entry) => [entry.key, spriteMasks(entry)]),
  );
  // Compact, keys sorted, like json.dump(sort_keys=True, separators=(",", ":")); names are ASCII.
  writeFileSync(OUT, `${JSON.stringify(sortedKeys({ version: 1, sprites }))}\n`);
  pixel.updateManifest("data", [{ key: "contact-silhouettes", json: "contact-silhouettes.json" }]);
  console.log("built contact silhouettes:", Object.keys(sprites).sort().join(", "));
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build }));
}
