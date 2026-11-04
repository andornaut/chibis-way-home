/**
 * Export the approved storybook opening's painted sources and demonstrate its layered motion.
 *
 * Usage, from the repository root:
 *   node art/tools/opening.ts build            read art/opening/source; write three opaque 720x360
 *                                              background images, four 512x512 pose sheets with
 *                                              four 256x256 frames, and authoring contract and
 *                                              manifest-entry JSON
 *   node art/tools/opening.ts preview OUT.gif  a short motion study
 *   node art/tools/opening.ts board OUT.png    five sampled shots
 *
 * Every pose uses a canvas bottom-centre anchor at (128,232). Opening layers have no hit boxes.
 *
 * Chibi poses: rest, blink, sleep, wake. Ferret poses: friendly, gesture, argument, pack. Parcel
 * poses: open, half-closed, sealed, opened. Parcel-front repeats those frame indices and occludes
 * the lower part of the bird when he is inside the carton. Source cutouts are normalized to binary
 * alpha; their soft painted colours are retained. Gameplay pixel assets are unchanged.
 *
 * The preview is a motion study, not runtime playback policy. Its illustrative time scale does not
 * choose scene duration, controls, skip, replay or save behaviour. Pose changes, breathing,
 * gestures, a sleeping-bird transfer, lid closure, parcel travel and waking are actual layer
 * motion. No argument cause, dialogue, character-name artwork or friendship outcome is supplied.
 *
 * Smooth resizing and rotation use Skia's high-quality image sampling, and board labels use the
 * committed font-body bitmap font.
 */

import { mkdirSync, writeFileSync } from "node:fs";

import { encodeGif } from "@andornaut/art-kit/gif";
import { encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/png";
import { quantise } from "@andornaut/art-kit/quantise";
import {
  composite,
  crop,
  fill,
  filledImage,
  mapChannels,
  opaque,
  paste,
} from "@andornaut/art-kit/raster";
import { opaqueRect, type RgbaImage } from "@andornaut/art-kit/rgbaImage";
import { Canvas, ImageData } from "skia-canvas";

import { commands, run } from "./cli.ts";
import { cropBox, readImage } from "./imageArt.ts";
import * as pixel from "./pixel.ts";
import { drawLabel } from "./previewText.ts";

const SOURCE = "art/opening/source";
const AUTHORING = "art/opening";
const VIEW = [720, 360] as const;
const FRAME = [256, 256] as const;
const ANCHOR = [128, 232] as const;
const BACKGROUNDS = ["home", "transit", "depot"] as const;
type Kind = "chibi" | "ferret" | "parcel";
interface PoseSpec {
  tags: readonly string[];
  envelope: readonly [width: number, height: number];
}
const POSES: Readonly<Record<Kind, PoseSpec>> = {
  chibi: { tags: ["rest", "blink", "sleep", "wake"], envelope: [208, 88] },
  ferret: { tags: ["friendly", "gesture", "argument", "pack"], envelope: [220, 190] },
  parcel: { tags: ["open", "half-closed", "sealed", "opened"], envelope: [220, 156] },
};
const TAU = 2 * Math.PI;
const PNG_OPTIONS = { deflateLevel: 9, deflateStrategy: 3, filterType: -1 };
const USAGE = "Usage: opening.ts build | preview OUT.gif | board OUT.png";

type Box = readonly [left: number, top: number, right: number, bottom: number];

const IDENTITY = Array.from({ length: 256 }, (_, i) => i);
const BINARY = IDENTITY.map((alpha) => (alpha >= 128 ? 255 : 0));

/** Alpha of 128 and above becomes opaque, everything else clear; colours are kept. */
function binaryAlpha(image: RgbaImage): RgbaImage {
  return mapChannels([IDENTITY, IDENTITY, IDENTITY, BINARY], image);
}

/** The box of every pixel with nonzero alpha, as left, top, right, bottom; undefined when clear. */
function alphaBox(image: RgbaImage): Box | undefined {
  const r = opaqueRect({ x: 0, y: 0, width: image.width, height: image.height }, image);
  return r && [r.x, r.y, r.x + r.width, r.y + r.height];
}

function imageData(image: RgbaImage): ImageData {
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}

function canvasPixels(canvas: Canvas): RgbaImage {
  const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  return {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  };
}

function smoothCanvas(width: number, height: number): Canvas {
  const canvas = new Canvas(width, height);
  canvas.gpu = false;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return canvas;
}

/** image resampled smoothly to width x height. */
function resizeSmooth(width: number, height: number, image: RgbaImage): RgbaImage {
  // re-baseline: no Pillow-exact LANCZOS/BICUBIC
  const canvas = smoothCanvas(width, height);
  canvas
    .getContext("2d")
    .drawImage(imageData(image), 0, 0, image.width, image.height, 0, 0, width, height);
  return canvasPixels(canvas);
}

/** image rotated counter-clockwise by angle degrees about centre, keeping its size. */
function rotateSmooth(angle: number, [cx, cy]: readonly [number, number], image: RgbaImage) {
  // re-baseline: no Pillow-exact LANCZOS/BICUBIC
  const canvas = smoothCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.translate(cx, cy);
  context.rotate(-angle * (Math.PI / 180));
  context.translate(-cx, -cy);
  context.drawImage(imageData(image), 0, 0);
  return canvasPixels(canvas);
}

function writePng(path: string, image: RgbaImage): void {
  writeFileSync(path, encodeRgbaPng(PNG_OPTIONS, image));
}

function writeRgbPng(path: string, image: RgbaImage): void {
  writeFileSync(path, encodeRgbPng(PNG_OPTIONS, opaque(image)));
}

function sourceCells(kind: Kind, [width, height]: readonly [number, number]): Box[] {
  const middle = Math.floor(height / 2);
  if (kind === "parcel") {
    // The source's open flaps use more horizontal space than its closed carton.
    const [topSplit, bottomSplit] = [pixel.round(width * 0.54), pixel.round(width * 0.49)];
    return [
      [0, 0, topSplit, middle],
      [topSplit, 0, width, middle],
      [0, middle, bottomSplit, height],
      [bottomSplit, middle, width, height],
    ];
  }
  const split = Math.floor(width / 2);
  return [
    [0, 0, split, middle],
    [split, 0, width, middle],
    [0, middle, split, height],
    [split, middle, width, height],
  ];
}

function poseFrames(spec: PoseSpec, kind: Kind): RgbaImage[] {
  const source = binaryAlpha(readImage(`${SOURCE}/${kind}-poses.png`));
  const crops = sourceCells(kind, [source.width, source.height]).map((cell) => {
    const pose = cropBox(cell, source);
    const bounds = alphaBox(pose);
    if (bounds === undefined) throw new Error(`Empty opening pose: ${kind}`);
    return cropBox(bounds, pose);
  });
  const scale = Math.min(
    spec.envelope[0] / Math.max(...crops.map((p) => p.width)),
    spec.envelope[1] / Math.max(...crops.map((p) => p.height)),
  );
  return crops.map((sourcePose) => {
    const width = Math.max(1, pixel.round(sourcePose.width * scale));
    const height = Math.max(1, pixel.round(sourcePose.height * scale));
    const pose = binaryAlpha(resizeSmooth(width, height, sourcePose));
    const frame = filledImage([0, 0, 0, 0], ...FRAME);
    composite(
      { x: ANCHOR[0] - Math.floor(pose.width / 2), y: ANCHOR[1] - pose.height },
      pose,
      frame,
    );
    return frame;
  });
}

function spriteMetadata(key: string, tags: readonly string[], frames: readonly RgbaImage[]) {
  return {
    frames: Object.fromEntries(
      frames.map((_, index) => [
        `${key}-${index}`,
        {
          frame: { x: (index % 2) * 256, y: Math.floor(index / 2) * 256, w: 256, h: 256 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 256, h: 256 },
          sourceSize: { w: 256, h: 256 },
          duration: 1000,
        },
      ]),
    ),
    meta: {
      app: "opening-art",
      image: `${key}.png`,
      format: "RGBA8888",
      size: { w: 512, h: 512 },
      scale: "1",
      frameTags: tags.map((name, index) => ({
        name,
        from: index,
        to: index,
        direction: "forward",
      })),
    },
  };
}

function writeSprite(key: string, tags: readonly string[], frames: readonly RgbaImage[]) {
  const directory = "public/art/sprites";
  mkdirSync(directory, { recursive: true });
  const sheet = filledImage([0, 0, 0, 0], 512, 512);
  frames.forEach((pose, index) =>
    composite({ x: (index % 2) * 256, y: Math.floor(index / 2) * 256 }, pose, sheet),
  );
  writePng(`${directory}/${key}.png`, sheet);
  pixel.writeJson({}, `${directory}/${key}.json`, spriteMetadata(key, tags, frames));
  return { key, png: `sprites/${key}.png`, json: `sprites/${key}.json`, once: [] };
}

export function build(): void {
  const images = "public/art/images";
  mkdirSync(images, { recursive: true });
  const entries: { images: unknown[]; sprites: unknown[] } = { images: [], sprites: [] };
  const contract = {
    viewport: { width: 720, height: 360 },
    frame: { width: 256, height: 256, columns: 2, rows: 2 },
    anchor: { x: 128, y: 232 },
    backgrounds: {} as Record<string, string>,
    poses: {} as Record<string, Record<string, number>>,
    parcelFrontEdges: [] as number[],
    layerOrder: ["background", "parcel", "actors", "parcel-front"],
  };
  for (const name of BACKGROUNDS) {
    const key = `opening-${name}-background`;
    const picture = resizeSmooth(...VIEW, opaque(readImage(`${SOURCE}/${name}.png`)));
    writeRgbPng(`${images}/${key}.png`, picture);
    entries.images.push({ key, png: `images/${key}.png`, width: 720, height: 360 });
    contract.backgrounds[name] = key;
  }
  for (const [kind, spec] of Object.entries(POSES) as [Kind, PoseSpec][]) {
    const frames = poseFrames(spec, kind);
    const key = `opening-${kind}`;
    entries.sprites.push(writeSprite(key, spec.tags, frames));
    const poses = Object.fromEntries(spec.tags.map((name, index) => [name, index]));
    contract.poses[key] = poses;
    if (kind === "parcel") {
      const fractions = [0.48, 0.36, 0.0, 0.5];
      const front = frames.map((pose, index) => {
        const [, top, , bottom] = alphaBox(pose) as Box;
        const edge = top + pixel.round((bottom - top) * (fractions[index] as number));
        const layer = { ...pose, data: pose.data.slice() };
        if (edge > 0) fill({ rect: { x: 0, y: 0, width: 256, height: edge } }, [0, 0, 0, 0], layer);
        contract.parcelFrontEdges.push(edge);
        return layer;
      });
      const frontKey = "opening-parcel-front";
      entries.sprites.push(writeSprite(frontKey, spec.tags, front));
      contract.poses[frontKey] = poses;
    }
  }
  pixel.writeJson({}, `${AUTHORING}/contract.json`, contract);
  pixel.writeJson({}, `${AUTHORING}/manifest-entries.json`, entries);
  console.log("Exported three opening backgrounds and four pose sheets");
}

const sheets = new Map<string, RgbaImage>();

function readCached(path: string): RgbaImage {
  let image = sheets.get(path);
  if (!image) {
    image = readImage(path);
    sheets.set(path, image);
  }
  return image;
}

function readPose(key: string, index: number): RgbaImage {
  const sheet = readCached(`public/art/sprites/${key}.png`);
  return crop(
    { x: (index % 2) * 256, y: Math.floor(index / 2) * 256, width: 256, height: 256 },
    sheet,
  );
}

interface ActorOptions {
  scale?: number;
  angle?: number;
  opacity?: number;
}

function actor(
  { angle = 0, opacity = 1, scale = 1 }: ActorOptions,
  canvas: RgbaImage,
  feet: readonly [number, number],
  key: string,
  index: number,
): void {
  let pose = readPose(key, index);
  if (angle) pose = rotateSmooth(angle, ANCHOR, pose);
  if (opacity < 1) {
    const alpha = IDENTITY.map((value) => pixel.round(value * opacity));
    pose = mapChannels([IDENTITY, IDENTITY, IDENTITY, alpha], pose);
  }
  if (scale !== 1) {
    const size = pixel.round(256 * scale);
    pose = resizeSmooth(size, size, pose);
  }
  composite(
    { x: pixel.round(feet[0] - ANCHOR[0] * scale), y: pixel.round(feet[1] - ANCHOR[1] * scale) },
    pose,
    canvas,
  );
}

/** A normalized motion demonstration, independent of production playback timing. */
export function studyFrame(beat: number, phase: number): RgbaImage {
  const background = beat === 4 ? "depot" : beat === 3 ? "transit" : "home";
  const committed = readCached(`public/art/images/opening-${background}-background.png`);
  const image = { ...committed, data: committed.data.slice() };
  const breathe = 1 + 0.012 * Math.sin(phase * TAU * 2);
  if (beat === 0) {
    actor(
      { scale: breathe },
      image,
      [244, 270],
      "opening-chibi",
      0.44 < phase && phase < 0.49 ? 1 : 0,
    );
    actor({}, image, [466, 270], "opening-ferret", 0.26 < phase && phase < 0.68 ? 1 : 0);
  } else if (beat === 1) {
    const chibiX = 244 - 16 * Math.sin(phase * Math.PI);
    actor({}, image, [chibiX, 270], "opening-chibi", phase > 0.7 ? 1 : 0);
    actor({ angle: 2 * Math.sin(phase * Math.PI) }, image, [452, 270], "opening-ferret", 2);
  } else if (beat === 2) {
    const parcelFrame = phase < 0.66 ? 0 : phase < 0.82 ? 1 : 2;
    actor({}, image, [358, 270], "opening-parcel", parcelFrame);
    actor({}, image, [458, 270], "opening-ferret", 3);
    if (phase < 0.76) {
      const transfer = Math.min(1, phase / 0.6);
      const birdX = 260 + 98 * transfer;
      const birdY = 238 - 30 * Math.sin(transfer * Math.PI);
      actor({ scale: breathe }, image, [birdX, birdY], "opening-chibi", 2);
    }
    actor({}, image, [358, 270], "opening-parcel-front", parcelFrame);
  } else if (beat === 3) {
    actor(
      { angle: 2 * Math.sin(phase * TAU * 2) },
      image,
      [-110 + phase * 940, 236 + 4 * Math.sin(phase * TAU)],
      "opening-parcel",
      2,
    );
  } else {
    const parcelFrame = phase < 0.12 ? 2 : phase < 0.24 ? 1 : 3;
    actor({}, image, [360, 270], "opening-parcel", parcelFrame);
    if (phase > 0.24) {
      const birdFrame = phase < 0.42 ? 2 : phase < 0.64 ? 3 : 0;
      const birdY = 234 - 20 * Math.min(1, Math.max(0, (phase - 0.42) / 0.3));
      actor({ scale: breathe }, image, [360, birdY], "opening-chibi", birdFrame);
    }
    actor({}, image, [360, 270], "opening-parcel-front", parcelFrame);
  }
  return opaque(image);
}

export function preview(path: string): void {
  // Art study cadence only. Gameplay data supplies all actual scene durations and controls.
  const frames: RgbaImage[] = [];
  for (let beat = 0; beat < 5; beat++)
    for (let index = 0; index < 30; index++) frames.push(studyFrame(beat, index / 29));
  const { frames: indexed } = quantise({ maxColours: 256 }, frames);
  writeFileSync(path, encodeGif({ loop: 0, durations: 100, disposal: 2 }, indexed));
  console.log(path);
}

export function board(path: string): void {
  const points: readonly (readonly [number, number, string])[] = [
    [0, 0.4, "Friendship"],
    [1, 0.5, "Argument"],
    [2, 0.5, "Sleeping Chibi is packed"],
    [3, 0.5, "Postal transit"],
    [4, 0.5, "Waking far from home"],
  ];
  const page = filledImage([...pixel.rgb("222034"), 255], 1440, 1176);
  points.forEach(([beat, phase, label], index) => {
    const [x, y] = [(index % 2) * 720, Math.floor(index / 2) * 392];
    drawLabel({ x: x + 12, y: y + 10, colour: "ead4aa" }, label, page);
    paste({ at: { x, y: y + 32 } }, studyFrame(beat, phase), page);
  });
  writeRgbPng(path, page);
  console.log(path);
}

if (import.meta.main) run(() => commands({ usage: USAGE, build, preview, more: { board } }));
