import type { CrumblingPhase } from "@andornaut/game-kit/terrain/crumbling";

import { drawsFrom, type Tileset } from "../stage/index.ts";
import { objectTiles, type PlacedTile } from "./tiles.ts";

// Base object skin to the dedicated skin a crumbling object draws with.
export const CRUMBLING_SKINS: Readonly<Record<string, string>> = {
  "one-way-ledge": "crumbling-ledge",
};

export type CrumblingSkin = "intact" | "warning";

// The intact and warning tiles of a crumbling object; the warning skin inserts "-warn" after the
// mapped key. Throws for unmapped art or a skin missing from the tileset.
export function crumblingSkinTiles(
  tileset: Tileset,
  object: { readonly art: string; readonly height: number; readonly width: number },
): Readonly<Record<CrumblingSkin, readonly PlacedTile[]>> {
  const intact = CRUMBLING_SKINS[object.art];
  if (!intact) {
    throw new Error(`No crumbling skin for ${object.art}`);
  }
  const tiles = (skin: string) => {
    if (!drawsFrom(tileset, skin)) {
      throw new Error(`No crumbling skin ${skin} in the tileset`);
    }
    return objectTiles(
      tileset,
      skin,
      object.width / tileset.tileSize,
      object.height / tileset.tileSize,
    );
  };
  return { intact: tiles(intact), warning: tiles(`${intact}-warn`) };
}

// The skin shown for a phase: intact, warning, or none while absent.
export function crumblingAppearance(phase: CrumblingPhase): CrumblingSkin | undefined {
  return phase.kind === "absent" ? undefined : phase.kind === "warning" ? "warning" : "intact";
}
