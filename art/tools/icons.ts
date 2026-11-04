/**
 * The site's favicon and app icons: the bird on a muted powder-blue sunburst disc.
 *
 * Usage, from the repository root:
 *   node art/tools/icons.ts build            write every icon below
 *   node art/tools/icons.ts preview OUT.png  every icon at 1x on light and dark ground, the 16 and
 *                                            32 at 8x
 *
 * Plain PNGs (and one ICO), not Aseprite sprites and not manifest entries. Every pixel is fully
 * opaque or fully transparent. She is drawn from the sprite's shapes in art/tools/bird.ts at each
 * icon's own size, so each drawing is its own rasterization rather than a downscale: the round
 * cream head set into the body, the nape dip, the softened back, the tail tip, a flat tan wing, a
 * square ink dot eye and the short orange bill, with tan cel crescents, a white rim from 32px up
 * and a dark-slate outline.
 *
 * | Path                               | Size    | Drawing                | Ground                           |
 * | ---------------------------------- | ------- | ---------------------- | -------------------------------- |
 * | public/art/favicon-16.png          | 16x16   | 16, close-up           | disc, transparent outside        |
 * | public/art/favicon.png             | 32x32   | 32                     | disc, transparent outside        |
 * | public/favicon.ico                 | 16, 32  | the two favicons above | disc, transparent outside        |
 * | public/icons/apple-touch-icon.png  | 180x180 | 90, scaled 2x          | full-bleed sunburst square       |
 * | public/icons/icon-192.png          | 192x192 | 64, scaled 3x          | disc, transparent outside        |
 * | public/icons/icon-512.png          | 512x512 | 64, scaled 8x          | disc, transparent outside        |
 * | public/icons/icon-maskable-512.png | 512x512 | 64 at 78%, scaled 8x   | full-bleed sunburst, bird in 80% |
 *
 * From 32px up she stands whole in the disc, her head 0.18 of the side. At 16px she is a close-up,
 * her head and the top of her back cut off by the disc inside a 1px edge, so the 3x3 bill and the
 * 2x2 eye still read.
 *
 * The ground is a sunburst: twelve rays, alternating zone-blue and zone-blue-shade, from a point
 * just above the icon's centre (behind her), filling the disc and, on the full-bleed icons, the
 * whole square. At 16px the rays do not hold, so the disc is flat zone-blue.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { encodeIco } from "@andornaut/art-kit/ico";
import { encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/png";
import { composite, filledImage, opaque, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import { frameImage } from "./imageArt.ts";
import * as bird from "./bird.ts";
import * as pixel from "./pixel.ts";
import { Grid, K } from "./pixel.ts";

const USAGE = "Usage: icons.ts build | preview OUT.png";
const PNG = { deflateLevel: 9, deflateStrategy: 3, filterType: -1 };
const RAYS = ["zone-blue", "zone-blue-shade"] as const; // the sunburst's alternating rays
const RAY_COUNT = 12;
const FLAT = "zone-blue"; // the 16px ground, where the rays do not hold
type Ground = "disc" | "full" | "mask";
const OUTPUTS: Readonly<Record<string, readonly [side: number, ground: Ground, zoom: number]>> = {
  "public/art/favicon-16.png": [16, "disc", 1],
  "public/art/favicon.png": [32, "disc", 1],
  "public/icons/apple-touch-icon.png": [90, "full", 2],
  "public/icons/icon-192.png": [64, "disc", 3],
  "public/icons/icon-512.png": [64, "disc", 8],
  "public/icons/icon-maskable-512.png": [64, "mask", 8],
};
const ICO = "public/favicon.ico";
const MASK_SCALE = 0.78; // the subject's scale in the maskable icon, about the centre

// Her size in each drawing: her head's radius as a fraction of the side. From 32px up she stands
// whole in the disc; at 16px only her head and the top of her back show, cut off by the disc, so
// the bill and eye still read.
const WHOLE_R = 0.18;
const CLOSE = [0.54, 0.44, 0.3] as const; // the 16px close-up: head centre x, y and radius, as fractions of the side

type Bounds = readonly [left: number, top: number, right: number, bottom: number];

/**
 * Her side view with her head radius hr px, drawn from bird.ts's shapes: the round head set into
 * the body, the 3px nape dip, the softened back, the tail tip, a folded wing, the short bill, the
 * dot eye and (whole) the stub feet. place(bounds) returns the head centre for the figure's bounds
 * (left, top, right, bottom, relative to the head centre).
 */
function birdPx(
  { feet = true, place }: { feet?: boolean; place: (bounds: Bounds) => readonly [number, number] },
  side: number,
  hr: number,
): pixel.Frame {
  const s = hr / bird.HEAD_R;
  const bw = bird.BRX * s;
  const bh = bird.BRY * s;
  const dx = -bird.HEAD_X * bw; // body centre from the head centre
  const dy = bird.HEAD_UP * bh;
  const bounds: Bounds = [dx - bw - 4 * s, -hr, hr + 5 * s, dy + bh + (feet ? 2 * s : 0)];
  const [hx, hy] = place(bounds);
  const bx = hx + dx;
  const by = hy + dy;
  const g = new Grid(side, side);
  const ks = Math.max(1, pixel.round(3 * s));
  const light = side >= 32 ? bird.LIGHT : null;
  if (feet) {
    const fw = Math.max(2, pixel.round(4 * s));
    const fh = Math.max(1, pixel.round(2 * s));
    for (const fx of [-5, 2])
      g.rect(Math.trunc(bx + fx * s), Math.trunc(by + bh), fw, fh, "orange");
  }
  bird.cel(
    g,
    bird.inEll(bx - bw + s, by - s, 4.4 * s, 2.2 * s, -0.45),
    bird.BASE,
    bird.SHADE,
    null,
    Math.max(1, pixel.round(s)),
    1,
  );
  bird.cel(
    g,
    bird.inBody(bx, by, bw, bh, hx - hr * 0.7, bird.NAPE_DROP * s, bird.BACK_FLAT * s),
    bird.BASE,
    bird.SHADE,
    light,
    ks,
    1,
  );
  bird.cel(g, bird.inEll(hx, hy, hr, hr), bird.BASE, bird.SHADE, light, ks, 1);
  bird.flat(g, bird.inEll(bx - 2 * s, by + 2 * s, bw * 0.5, bh * 0.3, -0.3), bird.WING);
  g.rect(
    Math.trunc(hx + hr - 2 * s),
    Math.trunc(hy),
    Math.max(3, pixel.round(7 * s)),
    Math.max(2, pixel.round(5 * s)),
    "orange",
  ); // bill
  const e = Math.max(2, pixel.round(4 * s));
  g.rect(Math.trunc(hx), Math.trunc(hy - hr * 0.55), e, e, "ink"); // dot eye
  return g.outlined({ edge: () => K[bird.OUTLINE] as string });
}

/**
 * One drawing: ground is "disc" (transparent outside), "full" (sunburst square) or "mask"
 * (sunburst square, her shrunk into the central 80%).
 */
function icon(side: number, ground: Ground): pixel.Frame {
  const f = ground === "mask" ? MASK_SCALE : 1.0;
  const c = side / 2;
  const radius = (side / 2) * f;
  let fig: pixel.Frame;
  if (side <= 16) {
    const [cx, cy, r] = CLOSE;
    fig = birdPx({ feet: false, place: () => [cx * side, cy * side] }, side, r * side);
  } else {
    // the figure's bounds centred in the disc
    const centred = (b: Bounds) => [c - (b[0] + b[2]) / 2, c - (b[1] + b[3]) / 2] as const;
    fig = birdPx({ place: centred }, side, WHOLE_R * f * side);
  }

  const groundAt = (x: number, y: number): string => {
    if (side <= 16) return K[FLAT] as string;
    const a = Math.atan2(y + 0.5 - c * 0.95, x + 0.5 - c);
    return K[RAYS[Math.trunc(((a + Math.PI) / (2 * Math.PI)) * RAY_COUNT) % 2] as string] as string;
  };

  const out = new Grid(side, side);
  for (let y = 0; y < side; y++) {
    const figRow = fig[y] as pixel.Frame[number];
    const row = out.px[y] as pixel.Frame[number];
    for (let x = 0; x < side; x++) {
      const d = Math.sqrt((x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2);
      if (d <= radius - 1) {
        row[x] = figRow[x] || groundAt(x, y);
      } else if (d <= radius) {
        // a 1px edge of ground, so the 16px close-up's cut never meets the page
        row[x] = side <= 16 ? groundAt(x, y) : figRow[x] || groundAt(x, y);
      } else if (ground !== "disc") {
        row[x] = groundAt(x, y);
      }
    }
  }
  return out.px;
}

function image(px: pixel.Frame, z = 1): RgbaImage {
  const im = frameImage(px);
  return z !== 1 ? resizeNearest(im.width * z, im.height * z, im) : im;
}

function images(): Map<string, RgbaImage> {
  return new Map(
    Object.entries(OUTPUTS).map(([path, [side, ground, z]]) => [
      path,
      image(icon(side, ground), z),
    ]),
  );
}

function save(path: string, bytes: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

function build(): void {
  const ims = images();
  for (const [path, im] of ims) save(path, encodeRgbaPng(PNG, im));
  const fav16 = ims.get("public/art/favicon-16.png") as RgbaImage;
  const fav32 = ims.get("public/art/favicon.png") as RgbaImage;
  save(ICO, encodeIco([fav16, fav32]));
  console.log("built", [...ims.keys(), ICO].join(", "));
}

function preview(out: string): void {
  const ims = images();
  const small = [
    ims.get("public/art/favicon-16.png") as RgbaImage,
    ims.get("public/art/favicon.png") as RgbaImage,
  ];
  const zoom = small.map((im) => resizeNearest(im.width * 8, im.height * 8, im));
  const gap = 16;
  const rows: RgbaImage[] = [];
  for (const ground of ["dee1e6", "202124"]) {
    const w = [...ims.values()].reduce((sum, im) => sum + im.width, 0) + gap * (ims.size + 1);
    const row = filledImage([...pixel.rgb(ground), 255], w, 512 + 2 * gap);
    let x = gap;
    for (const im of ims.values()) {
      composite({ x, y: gap }, im, row);
      x += im.width + gap;
    }
    rows.push(row);
  }
  const zrow = filledImage(
    [...pixel.rgb("slate"), 255],
    zoom.reduce((sum, z) => sum + z.width, 0) + gap * 3,
    256 + 2 * gap,
  );
  let x = gap;
  for (const z of zoom) {
    composite({ x, y: gap }, z, zrow);
    x += z.width + gap;
  }
  rows.push(zrow);
  const sheet = filledImage(
    [...pixel.rgb("ink"), 255],
    Math.max(...rows.map((r) => r.width)),
    rows.reduce((sum, r) => sum + r.height, 0),
  );
  let y = 0;
  for (const r of rows) {
    composite({ x: 0, y }, r, sheet);
    y += r.height;
  }
  save(out, encodeRgbPng(PNG, opaque(sheet)));
}

if (import.meta.main) run(() => commands({ usage: USAGE, build, preview }));
