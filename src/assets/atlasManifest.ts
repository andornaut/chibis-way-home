import type { AsepriteSheet } from "@andornaut/game-kit/art/aseprite";

// The atlas a build packs art's PNGs into, as the build's code and the game both read it.

// Phaser's name for the frame that covers a whole texture.
export const BASE_FRAME = "__BASE";

// A frame's rect on its atlas page. A sprite's frame carries its sheet duration.
export interface AtlasFrame {
  readonly duration?: number;
  readonly h: number;
  readonly name: string;
  readonly w: number;
  readonly x: number;
  readonly y: number;
}

// One key of art's manifest, drawn from one atlas page: a sprite's frames in export order with
// its sheet tags, a tileset's tiles by index, or a font's or backdrop's one frame.
export interface AtlasTexture {
  readonly frames: readonly AtlasFrame[];
  readonly key: string;
  readonly page: number;
  readonly tags?: AsepriteSheet["meta"]["frameTags"];
}

interface AtlasPage {
  readonly height: number;
  // The page's URL in the build output.
  readonly url: string;
  readonly width: number;
}

export interface AtlasManifest {
  readonly pages: readonly AtlasPage[];
  readonly textures: readonly AtlasTexture[];
}

// The Phaser texture key an atlas page loads under. The colon keeps it apart from art's
// kebab-case keys.
export function atlasPageKey(page: number): string {
  return `atlas:${page}`;
}

// The json-hash sheet a sprite's animations are built from, as Phaser's Aseprite loader caches
// it: frame durations keyed by frame name, and the tags.
export function asepriteSheetOf({ frames, tags = [] }: AtlasTexture): AsepriteSheet {
  return {
    frames: Object.fromEntries(frames.map(({ duration = 0, name }) => [name, { duration }])),
    meta: { frameTags: tags },
  };
}
