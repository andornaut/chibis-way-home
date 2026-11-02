import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { decodePng } from "@andornaut/art-kit/png";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";
import { itemAt } from "@andornaut/game-kit/arrays";
import { describe, expect, it } from "vitest";

import { BASE_FRAME } from "../../assets/atlasManifest";
import { TILE } from "../../data/screen";
import { ART_MANIFEST_FILE, ART_PATH, type ArtManifest } from "../../view/aseprite";
import { buildAtlas } from "./atlasBuild";

const ART_DIR = join(import.meta.dirname, "../../../public", ART_PATH);
const readArt = async (path: string) => new Uint8Array(await readFile(join(ART_DIR, path)));
const ART = JSON.parse(new TextDecoder().decode(await readArt(ART_MANIFEST_FILE))) as ArtManifest;
const ATLAS = await buildAtlas({ encode: () => new Uint8Array(), readArt }, ART);

// Every PNG art's manifest lists for the game, by key: all but its images.
const PNGS: ReadonlyMap<string, string> = new Map(
  [...ART.sprites, ...ART.tilesets, ...ART.fonts, ...ART.backdrops].map(({ key, png }) => [
    key,
    png,
  ]),
);

function textureOf(key: string) {
  const texture = ATLAS.textures.find((candidate) => candidate.key === key);
  if (texture === undefined) {
    throw new Error(`${key} is not in the atlas`);
  }
  return texture;
}

// Where a PNG sits on its page: its frames' top-left.
const topLeft = (frames: readonly { x: number; y: number }[]) => ({
  x: Math.min(...frames.map(({ x }) => x)),
  y: Math.min(...frames.map(({ y }) => y)),
});

// The RGBA bytes of a rect of image, row by row.
function pixels(image: RgbaImage, x: number, y: number, width: number, height: number): number[] {
  const rows = Array.from({ length: height }, (_, row) => {
    const start = ((y + row) * image.width + x) * 4;
    return [...image.data.subarray(start, start + width * 4)];
  });
  return rows.flat();
}

describe("buildAtlas", () => {
  it("packs every PNG art's manifest lists for the game, once, and none of its images", () => {
    expect(ATLAS.textures.map(({ key }) => key).sort()).toEqual([...PNGS.keys()].sort());
  });

  it.each(ART.images)("lists image $key at its PNG's size", async ({ height, png, width }) => {
    const image = decodePng(await readArt(png));
    expect({ height: image.height, width: image.width }).toEqual({ height, width });
  });

  it.each(["bird", "font-body", "street-city-far", "tiles-platforming"])(
    "places %s's manifest source pixels at its game texture frames",
    async (key) => {
      const png = PNGS.get(key);
      if (png === undefined) {
        throw new Error(`No PNG ${key}`);
      }
      const texture = textureOf(key);
      const source = decodePng(await readArt(png));
      const { image: page } = itemAt(ATLAS.pages, texture.page);
      const { x, y } = topLeft(texture.frames);
      expect(pixels(page, x, y, source.width, source.height)).toEqual(
        pixels(source, 0, 0, source.width, source.height),
      );
    },
  );

  it.each(
    ["bird", "park-gate", "ui-button-primary"].map((key) => {
      const source = ART.sprites.find((sprite) => sprite.key === key);
      if (!source) {
        throw new Error(`No sprite ${key}`);
      }
      return [key, source.json] as const;
    }),
  )("keeps each of %s's frames at its rect in its PNG", async (key, json) => {
    const sheet = JSON.parse(new TextDecoder().decode(await readArt(json))) as {
      frames: Record<string, { frame: { h: number; w: number; x: number; y: number } }>;
    };
    const { frames } = textureOf(key);
    const origin = topLeft(frames);
    expect(
      frames.map(({ h, name, w, x, y }) => [name, { h, w, x: x - origin.x, y: y - origin.y }]),
    ).toEqual(Object.entries(sheet.frames).map(([name, { frame }]) => [name, frame]));
  });

  it.each(ART.tilesets.map(({ key }) => [key]))(
    "names %s's tiles by index in reading order, covering its PNG",
    (key) => {
      const tileSize = TILE;
      const { frames } = textureOf(key);
      const base = frames.find(({ name }) => name === BASE_FRAME);
      const tiles = frames.filter(({ name }) => name !== BASE_FRAME);
      const readingOrder = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
      expect(readingOrder.map(({ name }) => name)).toEqual(tiles.map((_, index) => String(index)));
      expect(tiles.every(({ h, w }) => w === tileSize && h === tileSize)).toBe(true);
      expect(tiles.length * tileSize ** 2).toBe((base?.w ?? 0) * (base?.h ?? 0));
      expect(new Set(tiles.map(({ x, y }) => `${x},${y}`)).size).toBe(tiles.length);
    },
  );
});
