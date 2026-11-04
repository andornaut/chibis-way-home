// Rectangles, points and sizes, in pixels and in tiles.

import type { Point as SharedPoint, Rect as SharedRect } from "@andornaut/game-kit/rect";

// An axis-aligned rectangle in base pixels: x and y are its top-left corner, y grows downward.
export type Rect = Readonly<SharedRect>;
export type Point = SharedPoint;

export type Size = Pick<Rect, "height" | "width">;

// A rectangle on the tile grid, in whole tiles: col and row are its top-left tile.
export interface TileRect {
  readonly col: number;
  readonly cols: number;
  readonly row: number;
  readonly rows: number;
}

export interface TilePoint {
  readonly col: number;
  readonly row: number;
}
export type Direction = "down" | "left" | "right" | "up";
