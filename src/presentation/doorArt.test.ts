import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import { type ArtManifest, sheetFrameSize } from "../assets";
import { ARCHETYPES } from "../data/archetypes";
import { CHARACTERS } from "../data/characters";
import { TILE } from "../data/screen";
import { artOffset } from "./objectArt";

const SHEETS = import.meta.glob<{
  readonly frames: Readonly<Record<string, { readonly sourceSize: { w: number; h: number } }>>;
}>("../../public/art/sprites/*.json", { eager: true, import: "default" });
const MANIFEST = manifestJson as ArtManifest;

// Use reaches a door by its rect, cols by rows tiles where it is placed (rules/zone's doorAt),
// so a door must be drawn over exactly that rect. Tiles and placeholders fill it by
// construction; a sprite fills it when its frame is the rect's size.
const DOOR_SPRITES = Object.entries(CHARACTERS).filter(
  ([, character]) =>
    ARCHETYPES[character.archetype]?.collision === "use" &&
    MANIFEST.sprites.some(({ key }) => key === character.art),
);

describe("door art", () => {
  it("has a door drawn as a sprite to check", () => {
    expect(DOOR_SPRITES.length).toBeGreaterThan(0);
  });

  it.each(DOOR_SPRITES)("draws %s's sprite over its whole rect", (_, character) => {
    const rect = { height: character.rows * TILE, width: character.cols * TILE };
    const frame = sheetFrameSize(
      SHEETS[`../../public/art/sprites/${character.art}.json`] ?? { frames: {} },
    );
    expect({ frame, offset: artOffset("sprite", rect, frame) }).toEqual({
      frame: rect,
      offset: { x: 0, y: 0 },
    });
  });
});
