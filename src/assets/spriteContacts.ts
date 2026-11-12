import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";

import { prepareSpriteContact } from "../core/index.ts";
import type { Size, SpriteContact, SpriteSilhouettes } from "../data/types/index.ts";
import type { ArtManifest } from "./aseprite.ts";

export const CONTACT_SILHOUETTES = "contact-silhouettes";

// Validate the complete paired export before any actor can enter a stage.
export function spriteContacts(
  manifest: ArtManifest,
  sheetOf: (key: string) => AsepriteSheet,
  frameOf: (key: string) => Size,
  raw: unknown,
): Readonly<Record<string, SpriteContact>> {
  const data = raw as Partial<SpriteSilhouettes> | undefined;
  const required = manifest.sprites.filter((sprite) => sprite.contact === "silhouette");
  if (required.length === 0) {
    return {};
  }
  if (!data || data.version !== 1 || !data.sprites || typeof data.sprites !== "object") {
    throw new Error("Missing contact silhouette export");
  }
  const masks = data.sprites;
  return Object.fromEntries(
    required.map((sprite) => {
      const mask = masks[sprite.key];
      const sheet = sheetOf(sprite.key);
      if (
        !mask ||
        !Number.isSafeInteger(mask.width) ||
        !Number.isSafeInteger(mask.height) ||
        mask.width <= 0 ||
        mask.height <= 0
      ) {
        throw new Error(`Invalid silhouette dimensions for ${sprite.key}`);
      }
      const frame = frameOf(sprite.key);
      if (frame.width !== mask.width || frame.height !== mask.height) {
        throw new Error(`Silhouette frame size mismatch for ${sprite.key}`);
      }
      const names = Object.keys(sheet.frames);
      if (
        Object.keys(mask.frames).length !== names.length ||
        names.some((name) => !mask.frames[name])
      ) {
        throw new Error(`Missing silhouette frames for ${sprite.key}`);
      }
      for (const runs of Object.values(mask.frames)) {
        let previousY = -1,
          previousRight = -1;
        for (const [y, left, right] of runs) {
          if (
            ![y, left, right].every(Number.isSafeInteger) ||
            y < 0 ||
            y >= mask.height ||
            left < 0 ||
            left >= right ||
            right > mask.width ||
            y < previousY ||
            (y === previousY && left <= previousRight)
          ) {
            throw new Error(`Invalid silhouette runs for ${sprite.key}`);
          }
          previousRight = right;
          previousY = y;
        }
      }
      const tags = Object.fromEntries(
        [...sheetTags(sheet)].map(([tag, frames]) => {
          if (
            !frames.length ||
            frames.some((frame) => !Number.isFinite(frame.duration) || frame.duration <= 0)
          ) {
            throw new Error(`Invalid silhouette timing for ${sprite.key}:${tag}`);
          }
          return [
            tag,
            {
              frames: frames.map((frame) => ({
                frame: frame.frame,
                seconds: frame.duration / 1000,
              })),
              once: sprite.once.includes(tag),
            },
          ];
        }),
      );
      return [
        sprite.key,
        prepareSpriteContact({
          frame: { height: mask.height, width: mask.width },
          frames: mask.frames,
          tags,
        }),
      ];
    }),
  );
}
