import type { Scene } from "phaser";

import type { Palette } from "../ui/index.ts";

export function palette(scene: Pick<Scene, "cache">): Palette {
  return scene.cache.json.get("palette") as Palette;
}

// A palette colour by name, as a numeric tint.
export function paletteColour(scene: Pick<Scene, "cache">, name: string): number {
  const hex = palette(scene).colours[name];
  if (hex === undefined) {
    throw new Error(`The palette has no ${name}`);
  }
  return Number.parseInt(hex.slice(1), 16);
}
