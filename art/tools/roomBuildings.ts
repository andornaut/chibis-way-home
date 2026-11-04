/**
 * Complete outdoor building masses behind existing ordinary room entrances.
 *
 * Usage: node art/tools/roomBuildings.ts build | preview OUT.png, from the repository root.
 * Five static 180x180 (15x15 tile) backdrops: room-building-blue-cityscape,
 * room-building-industrial, room-building-countryside, room-building-woodland and
 * room-building-home-city. Bottom-left, default y600, repeat none. The transparent local opening
 * is x60,y96,w60,h84, matching the existing 60x84 room door. Place the facade at door
 * col-5,row-8, on the same 1,1 world plane behind the interactive door; both bottoms meet the
 * actual supporting terrain. No collision, safe lip, input prompt, animation, lights or baked
 * door. Indoor entrances reuse solid themed room walls and trim rather than these exterior
 * buildings.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { polygon } from "@andornaut/art-kit/draw";
import { decodePng, encodeRgbaPng } from "@andornaut/art-kit/png";
import {
  composite,
  crop,
  fill,
  filledImage,
  grayscale,
  type Plane,
  type Rgba,
  resizeNearest,
} from "@andornaut/art-kit/raster";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as pixel from "./pixel.ts";

const USAGE = "Usage: roomBuildings.ts build | preview OUT.png";
const PNG = { deflateLevel: 9, deflateStrategy: 3, filterType: -1 };
const SIZE = [180, 180] as const;
type Box = readonly [x0: number, y0: number, x1: number, y1: number];
const OPENING: Box = [60, 96, 120, 180];
const STYLES: Readonly<Record<string, readonly [zone: string, gable: boolean]>> = {
  "blue-cityscape": ["street", false],
  industrial: ["industrial", false],
  countryside: ["countryside", true],
  woodland: ["woodland", true],
  "home-city": ["homecity", false],
};
const OUT = "public/art/backdrops";

const colour = (name: string): Rgba => [...pixel.rgb(name), 255];

/** Pillow's Image.paste(colour, box): replace the pixels of an exclusive box. */
function paste(image: RgbaImage, [x0, y0, x1, y1]: Box, rgba: Rgba): void {
  fill({ rect: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } }, rgba, image);
}

function draw(style: string): RgbaImage {
  const [zone, gable] = STYLES[style] as readonly [string, boolean];
  const base = `bg-${zone}-near`;
  const shade = `${base}-shade`;
  const light = `${base}-light`;
  const roof = style === "woodland" ? "bg-woodland-near-wood" : shade;
  const image = blankImage(SIZE[0], SIZE[1]);
  const rectangle = (box: Box, c: string) => paste(image, box, colour(c));

  if (gable) {
    polygon(
      { fill: colour(roof) },
      [
        { x: 0, y: 52 },
        { x: 90, y: 0 },
        { x: 179, y: 52 },
      ],
      image,
    );
    polygon(
      { fill: colour(light) },
      [
        { x: 10, y: 52 },
        { x: 90, y: 12 },
        { x: 169, y: 52 },
      ],
      image,
    );
    rectangle([8, 52, 172, 180], base);
    rectangle([8, 58, 12, 180], light);
    rectangle([168, 58, 172, 180], shade);
    rectangle([0, 50, 180, 58], roof);
  } else {
    rectangle([0, 0, 180, 180], base);
    rectangle([0, 0, 180, 12], roof);
    rectangle([2, 3, 178, 7], light);
    rectangle([0, 12, 8, 180], light);
    rectangle([172, 12, 180, 180], shade);
    rectangle([8, 88, 172, 92], shade);
  }
  for (const x of [16, 132]) {
    rectangle([x, 104, x + 32, 144], shade);
    rectangle([x + 2, 106, x + 30, 142], light);
    rectangle([x + 15, 106, x + 17, 142], base);
    rectangle([x + 2, 122, x + 30, 124], base);
    rectangle([x - 2, 144, x + 34, 148], shade);
  }
  paste(image, OPENING, [0, 0, 0, 0]);
  return image;
}

function registry(): pixel.ManifestEntry[] {
  return Object.keys(STYLES).map((style) => ({
    key: `room-building-${style}`,
    png: `backdrops/room-building-${style}.png`,
    width: SIZE[0],
    height: SIZE[1],
    anchor: "bottom-left",
    y: 600,
    repeat: "none",
  }));
}

function save(path: string, image: RgbaImage): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodeRgbaPng(PNG, image));
}

function build(): void {
  for (const style of Object.keys(STYLES)) save(`${OUT}/room-building-${style}.png`, draw(style));
  pixel.updateManifest("backdrops", registry());
  console.log("built", Object.keys(STYLES).length, "room entrance buildings");
}

/** A grey plane as an opaque RGBA image, as Pillow decodes an L PNG. */
function fromPlane(plane: Plane): RgbaImage {
  const data = new Uint8Array(plane.width * plane.height * 4);
  plane.data.forEach((value, i) => data.set([value, value, value, 255], i * 4));
  return { width: plane.width, height: plane.height, data };
}

async function preview(out: string): Promise<void> {
  // Loaded by name: the room door is drawn by its own generator.
  const doorsModule = "./roomDoors.ts";
  const doors = (await import(doorsModule)) as { image: () => RgbaImage };
  const result = filledImage(colour("lgrey"), 960, 228);
  const sheet = decodePng(new Uint8Array(readFileSync("public/art/sprites/bird.png")));
  Object.keys(STYLES).forEach((style, i) => {
    const x = 6 + i * 192;
    composite({ x, y: 24 }, draw(style), result);
    composite({ x: x + OPENING[0], y: 24 + OPENING[1] }, doors.image(), result);
    composite({ x: x + 128, y: 162 }, crop({ x: 0, y: 0, width: 48, height: 42 }, sheet), result);
  });
  save(out, result);
  const stem = out.replace(/\.[^./]*$/, "");
  save(`${stem}-grey.png`, fromPlane(grayscale(result)));
  save(`${stem}-phone.png`, resizeNearest(1152, 274, result));
  save(`${stem}-3x.png`, resizeNearest(2880, 684, result));
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === "build") build();
  else if (argv.length === 2 && argv[0] === "preview") await preview(argv[1] as string);
  else {
    console.error(USAGE);
    process.exit(1);
  }
}
