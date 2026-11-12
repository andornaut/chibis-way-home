import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json" with { type: "json" };
import trapSheet from "../../public/art/sprites/goose-trap.json" with { type: "json" };
import tileset from "../../public/art/tilesets/tiles-platforming.json" with { type: "json" };
import { artHitboxes, type ArtManifest, sheetFrameSize } from "../assets/index.ts";
import { ARCHETYPES } from "../data/archetypes.ts";
import { CHARACTERS } from "../data/characters.ts";
import { TILE } from "../data/screen.ts";
import { objectLayout } from "./tiles.ts";

const catalogue = { archetypes: ARCHETYPES, characters: CHARACTERS };

describe("four-pixel red contact exports", () => {
  it.each([
    ["top", { height: 4, width: TILE, x: 0, y: TILE - 4 }],
    ["bottom", { height: 4, width: TILE, x: 0, y: 0 }],
    ["left", { height: TILE, width: 4, x: TILE - 4, y: 0 }],
    ["right", { height: TILE, width: 4, x: 0, y: 0 }],
  ] as const)(
    "resolves the authored %s surface exactly without changing its tile footprint",
    (side, box) => {
      const result = objectLayout(
        TILE,
        catalogue,
        {},
        tileset,
        {},
        { character: `red-edge-${side}`, col: 0, row: 0 },
      );
      expect(result.hitbox).toEqual(box);
      expect([result.width, result.height]).toEqual([TILE, TILE]);
      expect(result.contactCue).toBe("red-hazard");
    },
  );

  it("resolves the armed trap's four-pixel contact band from its manifest while retaining the full canvas", () => {
    const trap = manifest.sprites.find(({ key }) => key === "goose-trap")!;
    const hitboxes = artHitboxes(() => sheetFrameSize(trapSheet), {
      ...manifest,
      sprites: [trap],
    } as ArtManifest);
    const result = objectLayout(
      TILE,
      catalogue,
      hitboxes,
      undefined,
      {},
      { character: "goose-trap", col: 0, row: 0 },
    );
    expect(result.hitbox).toEqual({ height: 4, width: 24, x: 0, y: 8 });
    expect([result.width, result.height]).toEqual([2 * TILE, TILE]);
    expect(result.contactCue).toBe("red-hazard");
    expect(CHARACTERS["pigeon-poop"]?.contactCue).toBeUndefined();
  });
});
