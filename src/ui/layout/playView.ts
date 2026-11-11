import { SCREEN } from "../../data/screen";
import type { Point, Rect, Size } from "../../data/types";

// The canvas fills the page's play area (#game) at the game's scale, so where the play area is
// wider or taller than 2:1, the canvas is too. The game's SCREEN-sized view sits at the canvas's
// top, centred across, and the bars beside or below it are the canvas's own. Sizes are in base
// pixels, whole. The page keeps #game clear of the device's safe-area insets (src/main.css), so
// the whole canvas, the view included, is always inside the safe area.

// The game's view in a canvas canvasSize big.
export function playView(canvasSize: Size): Rect {
  return {
    height: SCREEN.height,
    width: SCREEN.width,
    x: Math.floor((Math.floor(canvasSize.width) - SCREEN.width) / 2),
    y: 0,
  };
}

// How far every control (pause, the skill HUD, Use, Jump and the move hint), placed in the
// view's own coordinates, moves to sit in a canvas canvasSize big: with the view, so each keeps
// its distances from the view's edges and none moves into a bar.
export function viewShift(canvasSize: Size): Point {
  const { x, y } = playView(canvasSize);
  return { x, y };
}

// A point moved by shift, or back by it with sign -1.
export function shifted(shift: Point, point: Point, sign: 1 | -1 = 1): Point {
  return { x: point.x + sign * shift.x, y: point.y + sign * shift.y };
}
