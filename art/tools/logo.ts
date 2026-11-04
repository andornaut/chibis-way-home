/**
 * The game's muted powder-blue wordmark and canonical cream bird, built from reusable pixel
 * shapes.
 *
 * Usage, from the repository root:
 *   node art/tools/logo.ts build            write the three logos and update their manifest image
 *                                           entries
 *   node art/tools/logo.ts preview OUT.png  each logo on pale steel and navy at 1x and 3x
 *
 * All images have transparent backgrounds and binary alpha. Canvas sizes and stable keys:
 * - logo: 558x239, full cream bird standing on a simple platform above flat Chibi's / Way Home
 *   lettering.
 * - logo-nav: 226x30, compact full bird beside Chibi's Way Home on one line.
 * - logo-icon: 53x41, full bird standing on a short powder-blue platform, with no lettering.
 *
 * WORDMARK supplies the title. GLYPHS is the 5x7 alphabet. Lettering uses zone-blue over a flat
 * dark-steel sign, with one quiet light edge and a dark outline, without extrusion, cyan
 * highlights or drop shadows. Bird shapes come from the protagonist drawing module; the cream
 * body, tan wing, orange bill and dot eye retain the protagonist's identity on both backgrounds.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";

import { line, rectangle } from "@andornaut/art-kit/draw";
import { encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/png";
import {
  composite,
  crop,
  filledImage,
  opaque,
  paste,
  resizeNearest,
} from "@andornaut/art-kit/raster";
import { blankImage, opaqueRect, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import { frameImage, rgba } from "./imageArt.ts";
import * as birdArt from "./bird.ts";
import * as pixel from "./pixel.ts";
import { Grid, K } from "./pixel.ts";

const USAGE = "Usage: logo.ts build | preview OUT.png";
const PNG = { deflateLevel: 9, deflateStrategy: 3, filterType: -1 };
const WORDMARK = ["Chibi's", "Way Home"] as const;
type Key = "logo" | "logo-nav" | "logo-icon";
const OUT: Readonly<Record<Key, string>> = {
  logo: "public/art/logo.png",
  "logo-nav": "public/art/logo-nav.png",
  "logo-icon": "public/art/logo-icon.png",
};

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  b: ["#....", "#....", "#.##.", "##..#", "#...#", "#...#", "####."],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".####"],
  h: ["#....", "#....", "#.##.", "##..#", "#...#", "#...#", "#...#"],
  i: ["..#..", ".....", ".##..", "..#..", "..#..", "..#..", ".###."],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  y: [".....", ".....", "#...#", "#...#", ".####", "....#", ".###."],
};

interface WordStyle {
  b: number;
  fill: string;
  light: string;
}
const BIG: WordStyle = { b: 11, fill: "zone-blue", light: "lgrey" };
const SMALL: WordStyle = { b: 9, fill: "zone-blue", light: "lgrey" };
const NAV: WordStyle = { b: 2, fill: "zone-blue", light: "zone-blue" };
const CANVASES: Readonly<Record<Key, readonly [number, number]>> = {
  logo: [558, 239],
  "logo-nav": [226, 30],
  "logo-icon": [53, 41],
};

/** Flat 5x7 lettering: one dark outline and a single upper-left light edge at larger sizes. */
function word({ b, fill, light }: WordStyle, text: string): RgbaImage {
  const gap = b;
  const cw = 5 * b + gap;
  const width = text.length * cw - gap + 2;
  const height = 7 * b + 2;
  const mask = new Set<number>(); // y * width + x
  [...text].forEach((ch, i) => {
    if (ch === " ") return;
    (GLYPHS[ch] as readonly string[]).forEach((row, gy) => {
      [...row].forEach((c, gx) => {
        if (c !== "#") return;
        for (let y = 0; y < b; y++)
          for (let x = 0; x < b; x++) mask.add((1 + gy * b + y) * width + 1 + i * cw + gx * b + x);
      });
    });
  });
  const g = new Grid(width, height);
  for (const at of mask) {
    const x = at % width;
    const y = Math.floor(at / width);
    const rim = b >= 3 && (!mask.has(at - 1) || !mask.has(at - width));
    g.p(x, y, rim ? light : fill);
  }
  return frameImage(g.outlined({ edge: () => K.ink as string }));
}

function canvas(key: Key): RgbaImage {
  const [w, h] = CANVASES[key];
  return blankImage(w, h);
}

/** A restrained flat ledge: powder-blue face, light top and dark lower edge. */
function platform(im: RgbaImage, x: number, y: number, width: number): void {
  rectangle({ fill: rgba("ink") }, { x0: x, y0: y, x1: x + width - 1, y1: y + 3 }, im);
  line(
    { fill: rgba("lgrey") },
    [
      { x: x + 1, y },
      { x: x + width - 2, y },
    ],
    im,
  );
  rectangle(
    { fill: rgba("zone-blue") },
    { x0: x + 1, y0: y + 1, x1: x + width - 2, y1: y + 2 },
    im,
  );
}

/**
 * The bird's side view redrawn at s times its size: every shape scales, the outline and rim stay
 * 1px. pose is "rest" (standing, wing folded) or "downstroke" (in the air, the wing level behind
 * her, feet tucked under her belly).
 */
function birdAt(s: number, pose: "rest" | "downstroke" = "rest"): RgbaImage {
  const width = pixel.round(birdArt.W * s);
  const height = pixel.round(birdArt.H * s);
  const g = new Grid(width, height);
  const centre = width / 2;
  const bw = birdArt.BRX * s;
  const bh = birdArt.BRY * s;
  const air = pose === "downstroke";
  const bottom = air ? height - 1 - 2 * pixel.round(2 * s) : birdArt.BODY_BOTTOM * s;
  const bcy = bottom - bh;
  const hr = birdArt.HEAD_R * s;
  const hcx = centre + birdArt.HEAD_X * bw;
  const hcy = bcy - birdArt.HEAD_UP * bh;
  const fw = pixel.round(4 * s);
  const fh = pixel.round(2 * s);
  if (!air) g.rect(Math.trunc(centre - 5 * s), height - 1 - fh, fw, fh, "orange");
  birdArt.cel(
    g,
    birdArt.inEll(centre - bw + s, bcy - s, 4.4 * s, 2.2 * s, -0.45),
    birdArt.BASE,
    birdArt.SHADE,
    null,
    pixel.round(s),
    1,
  );
  birdArt.cel(
    g,
    birdArt.inBody(
      centre,
      bcy,
      bw,
      bh,
      hcx - hr * 0.7,
      birdArt.NAPE_DROP * s,
      birdArt.BACK_FLAT * s,
    ),
    birdArt.BASE,
    birdArt.SHADE,
    birdArt.LIGHT,
    pixel.round(3 * s),
    1,
  );
  if (air) {
    for (const dx of [-5, 2])
      g.rect(Math.trunc(centre + dx * s), Math.trunc(bottom), fw, pixel.round(s), "orange");
    const a = 172 * (Math.PI / 180);
    const ln = 15 * s;
    const sx = centre - 5 * s;
    const sy = bcy - bh * 0.45;
    birdArt.flat(
      g,
      birdArt.inEll(
        sx + Math.cos(a) * ln * 0.5,
        sy + Math.sin(a) * ln * 0.5,
        ln * 0.5,
        ln * 0.27,
        a,
      ),
      birdArt.WING,
    );
  } else {
    g.rect(Math.trunc(centre + 2 * s), height - 1 - fh, fw, fh, "orange");
  }
  birdArt.cel(
    g,
    birdArt.inEll(hcx, hcy, hr, hr),
    birdArt.BASE,
    birdArt.SHADE,
    birdArt.LIGHT,
    pixel.round(3 * s),
    1,
  );
  if (!air)
    birdArt.flat(
      g,
      birdArt.inEll(centre - 2 * s, bcy + 2 * s, bw * 0.5, bh * 0.3, -0.3),
      birdArt.WING,
    );
  g.rect(
    Math.trunc(hcx + hr - 2 * s),
    Math.trunc(hcy),
    pixel.round(7 * s),
    pixel.round(5 * s),
    "orange",
  );
  g.rect(
    Math.trunc(hcx),
    Math.trunc(hcy - hr * 0.55),
    pixel.round(4 * s),
    pixel.round(4 * s),
    "ink",
  );
  return frameImage(g.outlined({ edge: () => K[birdArt.OUTLINE] as string }));
}

/** image cropped to its non-transparent pixels, like Pillow's crop(getbbox()). */
function trimmed(im: RgbaImage): RgbaImage {
  const box = opaqueRect({ x: 0, y: 0, width: im.width, height: im.height }, im);
  if (!box) throw new Error("trimmed: the image is empty");
  return crop(box, im);
}

function logo(): RgbaImage {
  const im = canvas("logo");
  const d = trimmed(birdAt(1.6));
  composite({ x: Math.floor((im.width - d.width) / 2), y: 74 - d.height }, d, im);
  rectangle({ fill: rgba("ink") }, { x0: 35, y0: 76, x1: 522, y1: 238 }, im);
  rectangle({ fill: rgba("dslate") }, { x0: 36, y0: 77, x1: 521, y1: 237 }, im);
  platform(im, Math.floor((im.width - 210) / 2), 74, 210);
  for (const [text, spec, y] of [
    [WORDMARK[0], BIG, 82],
    [WORDMARK.slice(1).join(" "), SMALL, 168],
  ] as const) {
    const lettering = word(spec, text);
    composite({ x: Math.floor((im.width - lettering.width) / 2), y }, lettering, im);
  }
  return im;
}

function logoNav(): RgbaImage {
  const im = canvas("logo-nav");
  const d = trimmed(birdAt(0.65));
  composite({ x: 0, y: Math.floor((im.height - d.height) / 2) }, d, im);
  const lettering = word(NAV, WORDMARK.join(" "));
  rectangle({ fill: rgba("dslate") }, { x0: 31, y0: 6, x1: im.width - 1, y1: 23 }, im);
  composite({ x: 32, y: Math.floor((im.height - lettering.height) / 2) }, lettering, im);
  return im;
}

function logoIcon(): RgbaImage {
  const im = canvas("logo-icon");
  const d = trimmed(birdAt(0.85));
  composite({ x: Math.floor((im.width - d.width) / 2), y: 37 - d.height }, d, im);
  platform(im, 4, 37, 45);
  return im;
}

function images(): Map<Key, RgbaImage> {
  return new Map<Key, RgbaImage>([
    ["logo", logo()],
    ["logo-nav", logoNav()],
    ["logo-icon", logoIcon()],
  ]);
}

function save(path: string, bytes: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

function build(): void {
  const ims = images();
  for (const [key, im] of ims) save(OUT[key], encodeRgbaPng(PNG, im));
  const manifest = pixel.readManifest();
  const entries = new Map<string, pixel.ManifestEntry>();
  for (const entry of (manifest.images as pixel.ManifestEntry[] | undefined) ?? [])
    entries.set(entry.key, entry);
  for (const [key, im] of ims)
    entries.set(key, { key, png: basename(OUT[key]), width: im.width, height: im.height });
  manifest.images = [...entries.values()].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  );
  pixel.writeJson({}, pixel.MANIFEST, manifest);
  console.log("built", [...ims].map(([key, im]) => `${key} ${im.width}x${im.height}`).join(", "));
}

function preview(out: string): void {
  const ims = images();
  const tiles: RgbaImage[] = [];
  for (const ground of ["lgrey", "navy"])
    for (const z of [1, 3])
      for (const im of ims.values()) {
        const t = filledImage(rgba(ground), im.width + 16, im.height + 16);
        composite({ x: 8, y: 8 }, im, t);
        tiles.push(resizeNearest(t.width * z, t.height * z, t));
      }
  const width = Math.max(...tiles.map((t) => t.width));
  const sheet = filledImage(
    rgba("ink"),
    width,
    tiles.reduce((sum, t) => sum + t.height, 0),
  );
  let y = 0;
  for (const t of tiles) {
    paste({ at: { x: 0, y } }, opaque(t), sheet);
    y += t.height;
  }
  save(out, encodeRgbPng(PNG, sheet));
}

if (import.meta.main) run(() => commands({ usage: USAGE, build, preview }));
