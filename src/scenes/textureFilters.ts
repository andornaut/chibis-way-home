import { setTextureFilters } from "@andornaut/game-kit/view/phaser/textureFilter";
import type { Scene } from "phaser";

import { type ArtManifest, type AtlasManifest, atlasPageKey } from "../assets";

export type TextureFilter = "linear" | "nearest";

// Each texture list of art's manifest and its filter. Authored pixel art (sprites, tilesets,
// backdrops and standalone images: stage previews, logos, the start background) samples nearest
// at every scale, the fractional zoom included. The font rasters are antialiased Liberation Sans,
// so they sample linear. A new list needs its filter here before it type-checks.
export const MANIFEST_FILTERS = {
  backdrops: "nearest",
  fonts: "linear",
  images: "nearest",
  sprites: "nearest",
  tilesets: "nearest",
} as const satisfies Record<Exclude<keyof ArtManifest, "data">, TextureFilter>;

// The filter of every texture BootScene loads: each manifest key by its list, and each atlas
// page, which every sprite, tileset and backdrop on it shares, nearest.
export function textureFilters(
  manifest: Pick<ArtManifest, keyof typeof MANIFEST_FILTERS>,
  atlas: Pick<AtlasManifest, "pages"> | null,
): Map<string, TextureFilter> {
  const filters = new Map<string, TextureFilter>();
  for (const [list, filter] of Object.entries(MANIFEST_FILTERS)) {
    for (const { key } of manifest[list as keyof typeof MANIFEST_FILTERS]) {
      filters.set(key, filter);
    }
  }
  atlas?.pages.forEach((_, page) => filters.set(atlasPageKey(page), "nearest"));
  return filters;
}

// Sets the filter of every loaded texture (textureFilters). A texture that failed to load, which
// BootScene reports, is left out rather than stopping the game.
export function filterLoadedArt(
  scene: Pick<Scene, "textures">,
  manifest: Pick<ArtManifest, keyof typeof MANIFEST_FILTERS>,
  atlas: Pick<AtlasManifest, "pages"> | null,
): void {
  const filters = textureFilters(manifest, atlas);
  setTextureFilters(
    scene.textures,
    new Map([...filters].filter(([key]) => scene.textures.exists(key))),
  );
}
