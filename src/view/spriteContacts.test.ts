import type { AsepriteSheet } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import maskJson from "../../public/art/contact-silhouettes.json";
import manifestJson from "../../public/art/manifest.json";
import { ARCHETYPES } from "../data/archetypes";
import { BIRD } from "../data/bird";
import { CHARACTERS } from "../data/characters";
import { TILE } from "../data/screen";
import type { SpriteSilhouettes } from "../data/types";
import { startBehaviour } from "../rules/behaviour";
import { startBird } from "../rules/bird";
import { contactFrameAt } from "../rules/bodyContact";
import { objectLayout } from "../rules/tiles";
import { artHitboxes, type ArtManifest, sheetFrameSize } from "./aseprite";
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

it("validates paired body exports and initializes their active and scene-bound profiles", () => {
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
  const hitboxes = artHitboxes((key) => sheetFrameSize(sheet(key)), actual, contacts);
  const bird = startBird(BIRD, { x: 0, y: 0 });
  for (const [key, character] of Object.entries(CHARACTERS)) {
    if (!contacts[character.art] || !character.behaviour) {
      continue;
    }
    const object = objectLayout(
      TILE,
      { archetypes: ARCHETYPES, characters: CHARACTERS },
      hitboxes,
      undefined,
      {},
      { character: key, col: 0, row: 0, scene: "intro" },
    );
    for (const actor of [object, { ...object, scene: undefined }]) {
      const state = startBehaviour(BIRD, actor, bird);
      expect(state.active).toBe(actor.scene === undefined);
      expect(contactFrameAt(actor.contact!, state.animationTag!, 0).frame).toBeDefined();
    }
  }
  expect(Object.keys(contacts).sort()).toEqual(
    actual.sprites
      .filter((sprite) => sprite.contact === "silhouette")
      .map((sprite) => sprite.key)
      .sort(),
  );
});
