import type { AsepriteSheet } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import maskJson from "../../public/art/contact-silhouettes.json";
import manifestJson from "../../public/art/manifest.json";
import type { SpriteSilhouettes } from "../data/types";
import { type ArtManifest, sheetFrameSize } from "./aseprite";
import { spriteContacts } from "./spriteContacts";

const manifest: ArtManifest = {
  backdrops: [],
  data: [],
  fonts: [],
  images: [],
  sprites: [
    { contact: "silhouette", json: "actor.json", key: "actor", once: [], png: "actor.png" },
  ],
  tilesets: [],
};
const sheet: AsepriteSheet = {
  frames: { "actor 0": { duration: 100 } },
  meta: { frameTags: [{ direction: "forward", from: 0, name: "idle", to: 0 }] },
};
const data: SpriteSilhouettes = {
  sprites: { actor: { frames: { "actor 0": [[0, 1, 3]] }, height: 2, width: 4 } },
  version: 1,
};

describe("paired silhouette loading", () => {
  it("resolves exact exported frame names and the existing animation timing", () => {
    expect(
      spriteContacts(
        manifest,
        () => sheet,
        () => ({ height: 2, width: 4 }),
        data,
      ).actor,
    ).toEqual({
      frame: { height: 2, width: 4 },
      frames: data.sprites.actor?.frames,
      tags: { idle: { frames: [{ frame: "actor 0", seconds: 0.1 }], once: false } },
    });
  });
  it.each([
    undefined,
    { sprites: {}, version: 1 },
    { sprites: { actor: { frames: {}, height: 2, width: 4 } }, version: 1 },
  ] as const)("rejects missing masks instead of making the body harmless", (invalid) => {
    expect(() =>
      spriteContacts(
        manifest,
        () => sheet,
        () => ({ height: 2, width: 4 }),
        invalid,
      ),
    ).toThrow();
  });
});

it("validates every declared body against the actual paired frame export", () => {
  const sheets = import.meta.glob<
    AsepriteSheet & {
      readonly frames: Readonly<
        Record<
          string,
          {
            readonly duration: number;
            readonly sourceSize: { readonly w: number; readonly h: number };
          }
        >
      >;
    }
  >("../../public/art/sprites/*.json", { eager: true, import: "default" });
  const sheet = (key: string) => {
    const value = sheets[`../../public/art/sprites/${key}.json`];
    if (!value) {
      throw new Error(`Missing contact sheet ${key}`);
    }
    return value;
  };
  const actual = manifestJson as ArtManifest;
  const contacts = spriteContacts(actual, sheet, (key) => sheetFrameSize(sheet(key)), maskJson);
  expect(Object.keys(contacts).sort()).toEqual(
    actual.sprites
      .filter((sprite) => sprite.contact === "silhouette")
      .map((sprite) => sprite.key)
      .sort(),
  );
});
