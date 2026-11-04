import type { CrumblingPhase } from "@andornaut/game-kit/terrain/crumbling";

import type { AreaLayout, Rect } from "../data/types";
import { drawsFrom, type Tileset } from "../stage";
import { objectTiles, type PlacedTile } from "./tiles";

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

export interface CrumblingTerrainBatch {
  readonly supportId: Rect;
  readonly tiles: readonly PlacedTile[];
  readonly volume: Rect;
}

// Pass the single terrainTiles result for the full original area, retaining every chosen skin.
export function crumblingTerrainBatches(
  tile: number,
  area: AreaLayout,
  tiles: readonly PlacedTile[],
): {
  readonly permanentSolids: readonly Rect[];
  readonly permanentTiles: readonly PlacedTile[];
  readonly supports: readonly CrumblingTerrainBatch[];
} {
  const definitions = new Map(
    area.crumbling?.map((definition) => [definition.supportId, definition]),
  );
  const supports = area.solids.flatMap((supportId) => {
    const definition = definitions.get(supportId);
    return definition ? [{ supportId, tiles: [] as PlacedTile[], volume: definition.volume }] : [];
  });
  if (supports.length === 0) {
    return { permanentSolids: area.solids, permanentTiles: tiles, supports };
  }
  const bySupport = new Map(supports.map((support, index) => [support.supportId, index]));
  const columns = area.width / tile;
  const owners = new Map<number, number>();
  for (const [index, terrain] of area.terrain.entries()) {
    const owner = bySupport.get(area.solids[index]!);
    for (
      let row = terrain.row;
      row < Math.min(area.height / tile, terrain.row + terrain.rows);
      row++
    ) {
      for (let col = terrain.col; col < Math.min(columns, terrain.col + terrain.cols); col++) {
        const cell = row * columns + col;
        if (owner === undefined) {
          owners.delete(cell);
        } else {
          owners.set(cell, owner);
        }
      }
    }
  }
  const permanentTiles: PlacedTile[] = [];
  for (const placed of tiles) {
    const owner = owners.get(placed.row * columns + placed.col);
    if (owner === undefined) {
      permanentTiles.push(placed);
    } else {
      supports[owner]!.tiles.push(placed);
    }
  }
  return {
    permanentSolids: area.solids.filter((solid) => !bySupport.has(solid)),
    permanentTiles,
    supports,
  };
}

// The skin shown for a phase: intact, warning, or none while absent.
export function crumblingAppearance(phase: CrumblingPhase): CrumblingSkin | undefined {
  return phase.kind === "absent" ? undefined : phase.kind === "warning" ? "warning" : "intact";
}
