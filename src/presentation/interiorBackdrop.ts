import type { Point, Rect } from "../data/types";

// The authored rectangle clips both axes at world speed. Only native texture phase moves.
// Its vertical grid starts at the backdrop's declared art top, including partial rectangles.
export function interiorBackdrop(
  context: {
    readonly parallax: Point;
    readonly reference: Point;
    readonly scroll: Point;
    readonly textureTop: number;
  },
  bounds: Rect,
): { readonly position: Point; readonly textureX: number; readonly textureY: number } {
  const { parallax, reference, scroll, textureTop } = context;
  return {
    position: { x: bounds.x, y: bounds.y },
    textureX: bounds.x + (parallax.x - 1) * (scroll.x - reference.x),
    textureY: bounds.y - textureTop + (parallax.y - 1) * (scroll.y - reference.y),
  };
}
