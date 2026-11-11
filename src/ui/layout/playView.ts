import type { RenderFit } from "@andornaut/game-kit/view/renderScale";

import type { Point, Rect, Size } from "../../data/types";

// The canvas fills the page's play area (#game), its backing in device pixels (fit.backing), and
// the game's SCREEN-sized view draws fit.zoom device pixels per base pixel at the canvas's top,
// centred across, so where the play area is wider or taller than 2:1 the bars beside or below the
// view are the canvas's own. The page keeps #game clear of the device's safe-area insets
// (src/main.css), so the whole canvas, the view included, is always inside the safe area.

// The game's view in the canvas, in device pixels, whole: a camera's viewport.
export function playView(fit: RenderFit): Rect {
  return {
    height: fit.view.height,
    width: fit.view.width,
    x: Math.floor((fit.backing.width - fit.view.width) / 2),
    y: 0,
  };
}

// The whole canvas in base pixels: its backing at fit.zoom, so a camera at that zoom over the
// whole backing shows exactly this.
export function canvasSize(fit: RenderFit): Size {
  return { height: fit.backing.height / fit.zoom, width: fit.backing.width / fit.zoom };
}

// How far every control (pause, the skill HUD, Use, Jump and the move hint), placed in the
// view's own coordinates, moves to sit in the canvas, in base pixels: with the view, so each keeps
// its distances from the view's edges and none moves into a bar. The view's offset is whole in
// device pixels, so the shift can be fractional in base pixels.
export function viewShift(fit: RenderFit): Point {
  const { x, y } = playView(fit);
  return { x: x / fit.zoom, y: y / fit.zoom };
}

// A point moved by shift, or back by it with sign -1.
export function shifted(shift: Point, point: Point, sign: 1 | -1 = 1): Point {
  return { x: point.x + sign * shift.x, y: point.y + sign * shift.y };
}
