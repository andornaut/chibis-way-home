import { SCREEN } from "../../data/screen";
import type { Point, Rect, Size } from "../../data/types";

// The canvas fills the page's play area (#game) at the game's scale, so where the play area is
// wider or taller than 2:1, the canvas is too. The game's SCREEN-sized view sits at the canvas's
// top, centred across, and the bars beside or below it are the canvas's own. Sizes are in base
// pixels, whole.

// The game's view in a canvas canvasSize big.
export function playView(canvasSize: Size): Rect {
  return {
    height: SCREEN.height,
    width: SCREEN.width,
    x: Math.floor((Math.floor(canvasSize.width) - SCREEN.width) / 2),
    y: 0,
  };
}

// The on-screen controls' least distance, in base pixels, from each drawn edge to the edge
// they are placed against: the view's left, right and top, and the canvas's bottom.
export const CONTROL_EDGE = 8;

// How far the bottom controls (Use, Jump and the move hint) sit above the canvas's bottom edge,
// drawn edge to edge.
export const CONTROL_BOTTOM = 20;

// How far a control along the canvas's bottom (Use, Jump and the move hint) moves from where it
// sits in a canvas the game's own size: across with the view, so it stays inside it, and down
// to the canvas's bottom, so below the game it moves into the bar.
export function bottomShift(canvasSize: Size): Point {
  return { x: playView(canvasSize).x, y: Math.floor(canvasSize.height) - SCREEN.height };
}

// How far a control along the view's top (the pause button) moves from where it sits in a
// canvas the game's own size: across with the view, so it stays inside it.
export function topShift(canvasSize: Size): Point {
  return { x: playView(canvasSize).x, y: 0 };
}

// A point moved by shift, or back by it with sign -1.
export function shifted(shift: Point, point: Point, sign: 1 | -1 = 1): Point {
  return { x: point.x + sign * shift.x, y: point.y + sign * shift.y };
}
