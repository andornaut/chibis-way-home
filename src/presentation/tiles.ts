import type { HazardPhase, PhaseTiles, TerrainRect } from "../data/types";
import { namedTiles, type Tileset } from "../stage";

// The tileset key names, as lookup finds what loaded: undefined for an area without one, or one
// art does not have yet, which then draws flat. Throws for one whose tiles are not tile px.
export function loadedTileset(
  tile: number,
  lookup: (key: string) => Tileset | undefined,
  key: string | undefined,
): Tileset | undefined {
  const tileset = key === undefined ? undefined : lookup(key);
  if (tileset && tileset.tileSize !== tile) {
    throw new Error(`Tileset ${key} is not ${tile} px a tile`);
  }
  return tileset;
}

// A tile to draw at a column and row, by its index in the sheet.
export interface PlacedTile {
  readonly col: number;
  readonly index: number;
  readonly row: number;
}

// One row of a layered terrain look: its tile where it is open on the left, on the right, and
// between, the middle cycling through its list along the row (shifted 2 per row down, so a
// scatter such as pebbles does not line up).
interface LookLayer {
  readonly left: string;
  readonly middle: readonly string[];
  readonly right: string;
}

const layer = (left: string, middle: readonly string[], right: string): LookLayer => ({
  left,
  middle,
  right,
});

// A layered look's rows from its top down; the last repeats to the terrain's bottom. Looks not
// listed are a top row alternating with a joint every other column, over a face.
const LAYERED_LOOKS: Readonly<Record<string, readonly LookLayer[]>> = {
  // The park's ground: a grass top, one row of turf, then soil with pebbles on one tile in five.
  grass: [
    layer("grass-top-left", ["grass-top"], "grass-top-right"),
    layer("turf-left", ["turf"], "turf-right"),
    layer("soil-left", ["soil-pebbles", "soil", "soil", "soil", "soil"], "soil-right"),
  ],
};

function layersOf(look: string): readonly LookLayer[] {
  return (
    LAYERED_LOOKS[look] ?? [
      layer(`${look}-top-left`, [`${look}-top`, `${look}-top-joint`], `${look}-top-right`),
      layer(`${look}-face-left`, [`${look}-face`], `${look}-face-right`),
    ]
  );
}

// The tile names each terrain look draws with.
export function lookTiles(look: string): string[] {
  switch (look) {
    case "road":
      return ["road-top", "road", "kerb-left", "kerb-right"];
    case "post":
      return ["cap", "", "base"].flatMap((part) =>
        ["left", "right"].map((side) => ["post", part, side].filter(Boolean).join("-")),
      );
    default:
      return [
        ...new Set(layersOf(look).flatMap(({ left, middle, right }) => [left, ...middle, right])),
        ...["bottom", "slab"].flatMap((part) =>
          ["-left", "", "-right"].map((side) => `${look}-${part}${side}`),
        ),
      ];
  }
}

function indexOf(tileset: Tileset, name: string): number {
  const index = tileset.tiles[name];
  if (index === undefined) {
    throw new Error(`No tile ${name} in the tileset`);
  }
  return index;
}

// The tiles an area's terrain is drawn with, picked by each cell's look and its neighbours: a
// top row where nothing is above, a closed bottom row where nothing is below (a slab where
// nothing is above or below), ends where nothing is beside, kerbs where the sidewalk meets a
// road below it, and a post's cap, shaft and base by its rect.
export function terrainTiles(
  tileset: Tileset,
  cols: number,
  rows: number,
  solids: readonly TerrainRect[],
): PlacedTile[] {
  const cells: (TerrainRect | undefined)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => undefined),
  );
  for (const solid of solids) {
    for (let row = solid.row; row < Math.min(rows, solid.row + solid.rows); row++) {
      for (let col = solid.col; col < Math.min(cols, solid.col + solid.cols); col++) {
        (cells[row] as (TerrainRect | undefined)[])[col] = solid;
      }
    }
  }
  const at = (col: number, row: number) =>
    col < 0 || col >= cols || row >= rows ? "edge" : row < 0 ? undefined : cells[row]?.[col]?.look;
  const tiles: PlacedTile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const solid = cells[row]?.[col];
      if (!solid?.look) {
        continue;
      }
      const name = tileName(solid, col, row, at);
      tiles.push({ col, index: indexOf(tileset, name), row });
    }
  }
  return tiles;
}

function tileName(
  solid: TerrainRect,
  col: number,
  row: number,
  at: (col: number, row: number) => string | undefined,
): string {
  const look = solid.look as string;
  if (look === "post") {
    const side = col === solid.col ? "left" : "right";
    if (row === solid.row) {
      return `post-cap-${side}`;
    }
    return row === solid.row + solid.rows - 1 ? `post-base-${side}` : `post-${side}`;
  }
  if (look === "road") {
    return at(col, row - 1) === "road" ? "road" : "road-top";
  }
  const top = at(col, row - 1) === undefined;
  const openLeft = at(col - 1, row) === undefined;
  const openRight = at(col + 1, row) === undefined;
  if (top && openLeft && at(col - 1, row + 1) === "road") {
    return "kerb-left";
  }
  if (top && openRight && at(col + 1, row + 1) === "road") {
    return "kerb-right";
  }
  // Open below: a closed bottom, or a slab when also open above. It takes priority over layers.
  if (at(col, row + 1) === undefined) {
    const part = `${look}-${top ? "slab" : "bottom"}`;
    return openLeft ? `${part}-left` : openRight ? `${part}-right` : part;
  }
  // Its layer: how far below the open cell above it is, down to the look's last layer.
  const layers = layersOf(look);
  let depth = 0;
  while (depth < layers.length - 1 && at(col, row - depth - 1) !== undefined) {
    depth++;
  }
  const { left, middle, right } = layers[depth] as LookLayer;
  if (openLeft) {
    return left;
  }
  if (openRight) {
    return right;
  }
  return middle[(col + 2 * row) % middle.length] as string;
}

// The tiles an object of art, cols x rows tiles, is drawn with, from its top-left. A piece is
// drawn whole. A tile with -left and -right ends runs across the object's width, with a -top row
// where the tileset has one (a planter), or -bed rows under its first where it has those (a
// pond). A stacking tile sits on the bottom row with its stack above. Any other tile repeats
// across the object.
export function objectTiles(
  tileset: Tileset,
  art: string,
  cols: number,
  rows: number,
): PlacedTile[] {
  const piece = tileset.pieces[art];
  if (piece) {
    return piece.flatMap((line, row) => line.map((index, col) => ({ col, index, row })));
  }
  return namedTiles(tileset, art, cols, rows).map(({ col, name, row }) => ({
    col,
    index: indexOf(tileset, name),
    row,
  }));
}

// A timed hazard's tiles for each phase, cols x rows cells of each phase's left, middle and right
// tiles, or undefined until the tileset has every one of them, so the hazard draws procedurally.
export function phaseSkinTiles(
  tileset: Tileset,
  object: {
    readonly height: number;
    readonly phaseTiles?: Readonly<Record<HazardPhase, PhaseTiles>>;
    readonly width: number;
  },
): Readonly<Record<HazardPhase, readonly PlacedTile[]>> | undefined {
  const skin = object.phaseTiles;
  if (
    !skin ||
    !Object.values(skin).every((names) =>
      Object.values(names).every((name) => name in tileset.tiles),
    )
  ) {
    return undefined;
  }
  const cols = object.width / tileset.tileSize;
  const rows = object.height / tileset.tileSize;
  const cells = (names: PhaseTiles) =>
    Array.from({ length: rows * cols }, (_, cell) => {
      const col = cell % cols;
      const name = col === 0 ? names.left : col === cols - 1 ? names.right : names.middle;
      return { col, index: indexOf(tileset, name), row: Math.floor(cell / cols) };
    });
  return {
    active: cells(skin.active),
    inactive: cells(skin.inactive),
    warning: cells(skin.warning),
  };
}
