import { type AtlasBlit, buildAtlasPages } from "@andornaut/art-kit/atlasBuild";
import { decodePng } from "@andornaut/art-kit/png";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";
import { itemAt } from "@andornaut/game-kit/arrays";
import type { AsepriteSheet } from "@andornaut/game-kit/art/aseprite";

import { type ArtManifest, type AtlasFrame, type AtlasTexture, BASE_FRAME } from "../../assets";
import { TILE } from "../../data/screen";
import { EXTRUDE, layoutAtlas } from "./atlasLayout";

// A PNG of art's, with its frames' rects in it and, for a sprite, its tags.
interface Source {
  readonly frames: readonly AtlasFrame[];
  readonly image: RgbaImage;
  readonly key: string;
  readonly png: string;
  readonly tags?: AsepriteSheet["meta"]["frameTags"];
}

// An Aseprite json-hash export's frames, with each frame's rect.
interface AsepriteExport extends AsepriteSheet {
  readonly frames: Readonly<
    Record<
      string,
      { readonly duration: number; readonly frame: { h: number; w: number; x: number; y: number } }
    >
  >;
}

const wholeFrame = ({ height, width }: RgbaImage): AtlasFrame => ({
  h: height,
  name: BASE_FRAME,
  w: width,
  x: 0,
  y: 0,
});

// A tileset's whole PNG and its TILE-sized tiles in rows from the top-left, named by index as
// Phaser names the frames of a spritesheet BootScene loads with that frame size.
function tileFrames(image: RgbaImage): AtlasFrame[] {
  const tileSize = TILE;
  const columns = Math.floor(image.width / tileSize);
  const rows = Math.floor(image.height / tileSize);
  const tiles = Array.from({ length: columns * rows }, (_, index) => ({
    h: tileSize,
    name: String(index),
    w: tileSize,
    x: (index % columns) * tileSize,
    y: Math.floor(index / columns) * tileSize,
  }));
  return [wholeFrame(image), ...tiles];
}

// A sprite's frames in export order, each with its duration.
function spriteFrames({ frames }: AsepriteExport): AtlasFrame[] {
  return Object.entries(frames).map(([name, { duration, frame }]) => ({
    duration,
    h: frame.h,
    name,
    w: frame.w,
    x: frame.x,
    y: frame.y,
  }));
}

export interface AtlasBuildDependencies {
  readonly encode: (image: RgbaImage) => Uint8Array | Promise<Uint8Array>;
  readonly readArt: (path: string) => Promise<Uint8Array>;
}

export interface AtlasBuild {
  readonly pages: readonly { readonly bytes: Uint8Array; readonly image: RgbaImage }[];
  // Each key's frames at their rects on its page.
  readonly textures: readonly AtlasTexture[];
}

// Packs sprites, tilesets and backdrops whole into nearest-filtered atlas pages. Fonts
// retain dedicated PNG/FNT sources; standalone site images also stay outside the atlas.
export async function buildAtlas(
  { encode, readArt }: AtlasBuildDependencies,
  manifest: ArtManifest,
): Promise<AtlasBuild> {
  const readJson = async (path: string): Promise<unknown> =>
    JSON.parse(new TextDecoder().decode(await readArt(path)));
  const readPng = async (path: string) => decodePng(await readArt(path));
  const sources: Source[] = await Promise.all([
    ...manifest.sprites.map(async ({ json, key, png }) => {
      const sheet = (await readJson(json)) as AsepriteExport;
      return {
        frames: spriteFrames(sheet),
        image: await readPng(png),
        key,
        png,
        tags: sheet.meta.frameTags,
      };
    }),
    ...manifest.tilesets.map(async ({ key, png }) => {
      const image = await readPng(png);
      return { frames: tileFrames(image), image, key, png };
    }),
    ...manifest.backdrops.map(async ({ key, png }) => {
      const image = await readPng(png);
      return { frames: [wholeFrame(image)], image, key, png };
    }),
  ]);
  const layout = layoutAtlas(
    sources.map(({ image: { height, width }, key }) => ({ height, key, width })),
  );
  const pages = layout.pages.map(({ height, width }, page) => ({
    blits: [] as AtlasBlit[],
    height,
    metadata: page,
    width,
  }));
  const textures = layout.placements.map(({ key, page, x, y }): AtlasTexture => {
    const source = sources.find((candidate) => candidate.key === key);
    if (source === undefined) {
      throw new Error(`No art for ${key}`);
    }
    const { height, width } = source.image;
    itemAt(pages, page).blits.push({
      at: { x, y },
      from: { height, width, x: 0, y: 0 },
      source: source.png,
    });
    const frames = source.frames.map((frame) => ({ ...frame, x: frame.x + x, y: frame.y + y }));
    return source.tags === undefined
      ? { frames, key, page }
      : { frames, key, page, tags: source.tags };
  });
  const built = await buildAtlasPages(
    {
      decode: decodePng,
      decoded: new Map(sources.map(({ image, png }) => [png, image])),
      encode,
      extrude: EXTRUDE,
      read: readArt,
    },
    pages,
  );
  return { pages: built.map(({ bytes, image }) => ({ bytes, image })), textures };
}
