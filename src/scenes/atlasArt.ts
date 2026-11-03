import { itemAt } from "@andornaut/game-kit/arrays";
import type { Scene } from "phaser";
import atlas from "virtual:atlas-manifest";

import {
  asepriteSheetOf,
  type AtlasManifest,
  atlasPageKey,
  type AtlasTexture,
  BASE_FRAME,
} from "../assets/atlasManifest";

// The build's atlas, or null on the dev server, where every art file loads on its own.
export const ATLAS: AtlasManifest | null = atlas;

// Queues every atlas page, by its URL in the build output: call before the loader's path is set.
export function queueAtlasPages(scene: Scene, { pages }: AtlasManifest): void {
  pages.forEach(({ url }, page) => scene.load.image(atlasPageKey(page), url));
}

// A texture keyed as art's manifest keys it, whose frames are rects of its loaded atlas page.
// It shares the page's source, so the page uploads to the GPU once and every key on it draws in
// one batch, and code that names the key and its frames works as it does with the key's own
// files. A sprite's base frame is its first, as nothing draws a whole sheet, and its Aseprite
// sheet goes in the JSON cache, where Phaser's Aseprite loader would put it.
function addAtlasTexture(scene: Scene, atlased: AtlasTexture): void {
  const { frames, key, page, tags } = atlased;
  const texture = scene.textures.create(key, []);
  if (texture === null) {
    return;
  }
  texture.source.push(itemAt(scene.textures.get(atlasPageKey(page)).source, 0));
  const named = frames.some(({ name }) => name === BASE_FRAME)
    ? frames
    : [{ ...itemAt(frames, 0), name: BASE_FRAME }, ...frames];
  for (const { h, name, w, x, y } of named) {
    texture.add(name, 0, x, y, w, h);
  }
  if (tags !== undefined) {
    scene.cache.json.add(key, asepriteSheetOf(atlased));
  }
}

// Adds sprite, tile and backdrop aliases without changing their shared source filtering.
export function addAtlasArt(scene: Scene, { textures }: AtlasManifest): void {
  for (const texture of textures) {
    addAtlasTexture(scene, texture);
  }
}
