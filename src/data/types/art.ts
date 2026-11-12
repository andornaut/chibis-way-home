// What art supplies the rules: sprite silhouettes, contact boxes and hit boxes.

import type { Rect, Size } from "./geometry.ts";

// A sprite's hit box in its frame, with the frame's size: the game draws the frame centred on
// its object's rectangle along x and standing on its bottom edge.
export type PixelRun = readonly [y: number, left: number, right: number];

interface SpriteSilhouette {
  readonly width: number;
  readonly height: number;
  readonly frames: Readonly<Record<string, readonly PixelRun[]>>;
}

export interface SpriteSilhouettes {
  readonly version: 1;
  readonly sprites: Readonly<Record<string, SpriteSilhouette>>;
}

export interface SpriteContact {
  readonly frame: Size;
  readonly frames: Readonly<Record<string, readonly PixelRun[]>>;
  readonly tags: Readonly<
    Record<
      string,
      {
        readonly frames: readonly { readonly frame: string; readonly seconds: number }[];
        readonly once: boolean;
      }
    >
  >;
}

export interface ArtHitbox {
  readonly contact?: SpriteContact;
  readonly frame: Size;
  readonly hitbox: Rect;
}
