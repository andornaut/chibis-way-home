import type { Point, Rect } from "../data/types/index.ts";

// Camera compensation never changes the sprite's world-facing or animation state. Cropping
// retains only whole source pixels inside its authored chunk, without a WebGL geometry mask.
export function scenerySpriteFrame(
  context: {
    readonly coverage: { readonly width: number; readonly x: number };
    readonly parallax: Point;
    readonly scroll: Point;
  },
  frame: Rect,
): { readonly crop: Rect; readonly position: Point; readonly visible: boolean } {
  const { coverage, parallax, scroll } = context;
  const position = {
    x: frame.x + (1 - parallax.x) * (scroll.x - coverage.x),
    y: frame.y + (1 - parallax.y) * scroll.y,
  };
  const left = Math.max(0, Math.ceil(coverage.x - position.x));
  const right = Math.min(frame.width, Math.floor(coverage.x + coverage.width - position.x));
  return {
    crop: { height: frame.height, width: Math.max(0, right - left), x: left, y: 0 },
    position,
    visible: right > left,
  };
}
