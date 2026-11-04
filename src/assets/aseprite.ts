import type { ArtHitbox, Rect, Size, SpriteContact } from "../data/types";

// Art's sprites, as public/art/manifest.json lists them and art-kit writes their json-hash sheets.

// public/art/ is served here, with its manifest of everything BootScene loads.
export const ART_PATH = "/art/";
export const ART_MANIFEST_FILE = "manifest.json";
// The manifest's key in the loader's JSON cache.
export const ART_MANIFEST_KEY = "manifest";

// A backdrop piece: its bottom edge sits at world y, and repeat "x" tiles it across a run.
interface ArtBackdrop {
  readonly height: number;
  readonly key: string;
  readonly png: string;
  readonly repeat: "none" | "x";
  readonly width: number;
  readonly y: number;
}

// A plain image the site's HTML pages show, such as the logo, at its size in pixels. It ships as
// its own file under /art/, never on the game's atlas pages.
interface ArtImage {
  readonly height: number;
  readonly key: string;
  readonly png: string;
  readonly width: number;
}

export interface ArtManifest {
  readonly backdrops: readonly ArtBackdrop[];
  readonly data: readonly { readonly json: string; readonly key: string }[];
  readonly fonts: readonly { readonly fnt: string; readonly key: string; readonly png: string }[];
  readonly images: readonly ArtImage[];
  readonly sprites: readonly {
    // Where the sprite touches her as a hazard, in frame pixels, when it declares one.
    readonly hitbox?: Rect;
    readonly contact?: "silhouette";
    readonly json: string;
    readonly key: string;
    // The tags that play once and hold their last frame. Every other tag loops.
    readonly once: readonly string[];
    readonly png: string;
    // A 9-slice sprite's fixed edges, in pixels; its middle stretches.
    readonly slice?: {
      readonly bottom: number;
      readonly left: number;
      readonly right: number;
      readonly top: number;
    };
  }[];
  readonly tilesets: readonly {
    readonly json: string;
    readonly key: string;
    readonly png: string;
  }[];
}

// A sprite sheet's frame size, from its first frame: art's sprites draw every frame one size.
export function sheetFrameSize(sheet: {
  readonly frames: Readonly<Record<string, { readonly sourceSize: { w: number; h: number } }>>;
}): Size {
  const frame = Object.values(sheet.frames)[0];
  return { height: frame?.sourceSize.h ?? 0, width: frame?.sourceSize.w ?? 0 };
}

// The hit boxes the manifest's sprites declare, by sprite key, each with its sprite's frame size.
export function artHitboxes(
  frameOf: (key: string) => Size,
  manifest: ArtManifest,
  contacts: Readonly<Record<string, SpriteContact>> = {},
): Readonly<Record<string, ArtHitbox>> {
  return Object.fromEntries(
    manifest.sprites.flatMap(({ contact, hitbox, key }) => {
      if (contact === "silhouette" && !contacts[key]) {
        throw new Error(`Missing silhouette contact for ${key}`);
      }
      return hitbox
        ? [
            [
              key,
              { frame: frameOf(key), hitbox, ...(contacts[key] && { contact: contacts[key] }) },
            ] as const,
          ]
        : [];
    }),
  );
}
