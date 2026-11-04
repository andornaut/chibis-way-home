/**
 * Write the house and zone palettes and their ramps as data for the game: public/art/palette.json.
 *
 * Shape (every key sorted, colours as lower-case "#rrggbb", the file ending with a newline):
 *
 *   {
 *     "colours": {"amber": "#feae34", ...},   every palette colour by its K name in pixel.ts
 *     "darker": {"#181425": "#181425", ...}   each colour one ramp step down
 *   }
 *
 * Ink is the bottom of every ramp and maps to itself.
 *
 * The manifest lists it under "data" as {"key": "palette", "json": "palette.json"}.
 *
 * Usage:
 *   node art/tools/palette.ts build             write public/art/palette.json and list it
 *   node art/tools/palette.ts preview OUT.png   each colour beside its darker steps, scaled up
 *
 * Run from the repository root.
 */

import { basename } from "node:path";

import { Canvas } from "skia-canvas";

import { commands, run } from "./cli.ts";
import * as pixel from "./pixel.ts";

export const OUT = "public/art/palette.json";
const USAGE = "Usage: palette.ts build | preview OUT.png";

export function data(): Record<string, Record<string, string>> {
  const h = (c: string) => `#${pixel.hexc(c)}`;
  const table = (steps: number) =>
    Object.fromEntries(pixel.PALETTE.map((c) => [h(c), h(pixel.darker(c, steps))]));
  return {
    colours: Object.fromEntries(Object.entries(pixel.K).map(([name, c]) => [name, h(c)])),
    darker: table(1),
  };
}

export function build(): void {
  pixel.writeJson({ sortKeys: true }, OUT, data());
  pixel.updateManifest("data", [{ key: "palette", json: basename(OUT) }]);
  console.log("built palette");
}

function css(c: string): string {
  return `rgb(${pixel.rgb(c).join(",")})`;
}

/** One row per colour: the colour, then one and two ramp steps down. */
export async function preview({ cell = 24, gap = 4 }, out: string): Promise<void> {
  const order = (name: string) => pixel.PALETTE.indexOf(pixel.hex(name));
  const names = Object.keys(pixel.K).sort((a, b) => order(a) - order(b));
  const width = 3 * (cell + gap) + gap;
  const height = names.length * (cell + gap) + gap;
  const native = new Canvas(width, height);
  native.gpu = false;
  const ctx = native.getContext("2d");
  ctx.fillStyle = css("slate");
  ctx.fillRect(0, 0, width, height);
  names.forEach((name, i) => {
    [pixel.hexc(name), pixel.darker(name), pixel.darker(name, 2)].forEach((c, j) => {
      ctx.fillStyle = css(c);
      ctx.fillRect(gap + j * (cell + gap), gap + i * (cell + gap), cell, cell);
    });
  });
  const scaled = new Canvas(width * 3, height * 3);
  scaled.gpu = false;
  const scaledCtx = scaled.getContext("2d");
  scaledCtx.imageSmoothingEnabled = false;
  scaledCtx.drawImage(native, 0, 0, scaled.width, scaled.height);
  await scaled.toFile(out);
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview: (out) => preview({}, out) }));
}
