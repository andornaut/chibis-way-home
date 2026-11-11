import type { Scene } from "phaser";

import type { ArtManifest } from "../assets";

// Fonts have dedicated sources so their linear filtering (textureFilters.ts) never affects shared
// sprite atlas pages.
export function queueFontArt(scene: Scene, { fonts }: Pick<ArtManifest, "fonts">): void {
  for (const { fnt, key, png } of fonts) {
    scene.load.bitmapFont(key, png, fnt);
  }
}
