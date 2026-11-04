import { type Scene, Textures } from "phaser";

import type { ArtManifest } from "../assets";

// Fonts have dedicated sources so filtering never affects shared sprite atlas pages.
export function queueFontArt(scene: Scene, { fonts }: Pick<ArtManifest, "fonts">): void {
  for (const { fnt, key, png } of fonts) {
    scene.load.bitmapFont(key, png, fnt);
  }
}

export function filterFontArt(scene: Scene, { fonts }: Pick<ArtManifest, "fonts">): void {
  for (const { key } of fonts) {
    for (const source of scene.textures.get(key).source) {
      source.setFilter(Textures.FilterMode.LINEAR);
    }
  }
}
