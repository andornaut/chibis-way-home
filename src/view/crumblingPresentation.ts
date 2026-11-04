import type { CrumblingPhase } from "@andornaut/game-kit/terrain/crumbling";

import type { AreaLayout, Point, Rect } from "../data/types";
import { objectTiles, type PlacedTile, type Tileset } from "./tiles";

// Palette colour of warning cracks.
export const CRUMBLING_CRACK = "ink";

// Tile-local opaque body faces of skins that can crumble, below the navy, white and light grey
// safe lip and inside the side outlines (art/tools/obstacles.py ledge()).
export const CRUMBLING_FACES: Readonly<Record<string, Readonly<Record<string, Rect>>>> = {
  "tiles-platforming": {
    "one-way-ledge-left": { height: 1, width: 11, x: 1, y: 5 },
    "one-way-ledge-middle": { height: 1, width: 12, x: 0, y: 5 },
    "one-way-ledge-right": { height: 1, width: 11, x: 0, y: 5 },
  },
};

// The world-space opaque face of an object's actual selected tile skin, spanning its tiles.
export function crumblingObjectFace(
  key: string,
  tileset: Tileset,
  object: { readonly art: string; readonly height: number; readonly width: number },
  at: Point,
): Rect {
  const faces = CRUMBLING_FACES[key] ?? {};
  const size = tileset.tileSize;
  const rects = objectTiles(tileset, object.art, object.width / size, object.height / size).map(
    ({ col, index, row }) => {
      const name = Object.keys(faces).find((face) => tileset.tiles[face] === index);
      if (!name) {
        throw new Error(`No crumbling face for ${key} tile ${index}`);
      }
      const face = faces[name]!;
      return { ...face, x: at.x + col * size + face.x, y: at.y + row * size + face.y };
    },
  );
  if (
    rects.length === 0 ||
    rects.some(({ height, y }) => y !== rects[0]!.y || height !== rects[0]!.height)
  ) {
    throw new Error(`Crumbling face for ${object.art} must be one row band`);
  }
  const left = Math.min(...rects.map(({ x }) => x));
  const right = Math.max(...rects.map(({ width, x }) => x + width));
  return { height: rects[0]!.height, width: right - left, x: left, y: rects[0]!.y };
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

// The supplied opaque face excludes the skin's safe lip, outline and transparent margins.
// Fill these whole logical pixels with ink over the unchanged skin.
export function crumblingAppearance(
  phase: CrumblingPhase,
  face: Rect,
): { readonly cracks: readonly Rect[]; readonly visible: boolean } {
  if (phase.kind !== "warning") {
    return { cracks: [], visible: phase.kind !== "absent" };
  }
  const left = Math.ceil(face.x);
  const right = Math.floor(face.x + face.width) - 1;
  const top = Math.ceil(face.y);
  const bottom = Math.floor(face.y + face.height) - 1;
  const cracks: Rect[] = [];
  if (left <= right && top <= bottom) {
    const branches = right - left >= 8 ? [1 / 3, 2 / 3] : [1 / 2];
    const offsets = [0, 1, 2, 1, 0, -1, 0, 1];
    for (const fraction of branches) {
      const anchor = Math.round(left + fraction * (right - left));
      for (let index = 0; index < Math.min(offsets.length, bottom - top + 1); index++) {
        cracks.push({
          height: 1,
          width: 1,
          x: Math.max(left, Math.min(right, anchor + offsets[index]!)),
          y: top + index,
        });
      }
    }
  }
  return { cracks, visible: true };
}
