import type { Rect } from "../data/types";

// An art tileset's description (public/art/tilesets/<key>.json): tiles by name, as indices into
// the sheet counted row by row, and pieces (multi-tile units) as rows of indices, top row first.
// hitboxes: where a tile hurts her, in px within its cell, for the tiles that do not hurt across
// the whole cell.
export interface Tileset {
  readonly columns: number;
  readonly hitboxes?: Readonly<Record<string, Rect>>;
  readonly pieces: Readonly<Record<string, readonly (readonly number[])[]>>;
  readonly tileSize: number;
  readonly tiles: Readonly<Record<string, number>>;
}

// The tiles above a stacking tile, in art's rule for the cellar hatch: its steel leaf's top over
// the leaf, above each hatch edge.
const STACKS: Readonly<Record<string, string>> = {
  "hatch-left": "pit-leaf-left",
  "hatch-right": "pit-leaf-right",
};

// Whether an art key names a tile or piece in the tileset.
export function drawsFrom(tileset: Tileset, art: string): boolean {
  return art in tileset.pieces || art in tileset.tiles;
}

// The tiles, by name, an object of art, cols x rows tiles, is drawn with when art names a tile.
// objectTiles (src/view/tiles.ts) places them.
export function namedTiles(
  tileset: Tileset,
  art: string,
  cols: number,
  rows: number,
): { col: number; name: string; row: number }[] {
  const has = (name: string) => name in tileset.tiles;
  const stack = STACKS[art];
  const tiles: { col: number; name: string; row: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let name: string;
      if (stack) {
        const fromBottom = rows - 1 - row;
        if (fromBottom > 2) {
          continue;
        }
        name = [art, stack, `${stack}-top`][fromBottom] as string;
      } else {
        const base =
          row === 0 && has(`${art}-top`)
            ? `${art}-top`
            : row > 0 && has(`${art}-bed`)
              ? `${art}-bed`
              : art;
        const end = col === 0 ? "-left" : col === cols - 1 ? "-right" : "";
        name = cols > 1 && has(`${base}${end}`) ? `${base}${end}` : base;
      }
      tiles.push({ col, name, row });
    }
  }
  return tiles;
}

// Where an object drawn from a tile of tileset (as objectTiles draws it), cols x rows cells of
// tile px, hurts her, from its top-left: the bounding rectangle of its tiles' hit boxes, a tile
// without one hurting across its whole cell. Undefined for art that is not a tile, or when none
// of its tiles has a hit box, so the object hurts across its whole rectangle.
export function tileHitbox(
  tile: number,
  tileset: Tileset,
  art: string,
  cols: number,
  rows: number,
): Rect | undefined {
  const boxes = tileset.hitboxes ?? {};
  if (!(art in tileset.tiles) || art in tileset.pieces) {
    return undefined;
  }
  const tiles = namedTiles(tileset, art, cols, rows);
  if (!tiles.some(({ name }) => name in boxes)) {
    return undefined;
  }
  const scale = tile / tileset.tileSize;
  const rects = tiles.map(({ col, name, row }) => {
    const box = boxes[name] ?? { height: tileset.tileSize, width: tileset.tileSize, x: 0, y: 0 };
    return {
      bottom: row * tile + (box.y + box.height) * scale,
      left: col * tile + box.x * scale,
      right: col * tile + (box.x + box.width) * scale,
      top: row * tile + box.y * scale,
    };
  });
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  return {
    height: Math.max(...rects.map((rect) => rect.bottom)) - top,
    width: Math.max(...rects.map((rect) => rect.right)) - left,
    x: left,
    y: top,
  };
}
