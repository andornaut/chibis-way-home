import type { AreaLayout, ObjectLayout, Point, Rect } from "../data/types";

// Whole-area layers keep their original placement. A local layer explicitly fills one chunk.
export function chunkBackdropSpan(
  area: Pick<AreaLayout, "chunks" | "width">,
  object: Pick<ObjectLayout, "origin" | "width">,
): AreaLayout["chunks"][number] | undefined {
  if (object.width >= area.width) {
    return undefined;
  }
  return area.chunks.find(({ width, x }) => x === object.origin.x && width === object.width);
}

// The quad clips to the chunk at world speed; only its texture moves at the parallax rate.
// Vertical placement retains the authored art top and never tiles outside the source height.
export function chunkParallax(
  context: { readonly parallax: Point; readonly scroll: Point },
  bounds: Rect,
): { readonly position: Point; readonly textureX: number } {
  const { parallax, scroll } = context;
  return {
    position: { x: bounds.x, y: bounds.y + (1 - parallax.y) * scroll.y },
    textureX: (parallax.x - 1) * (scroll.x - bounds.x),
  };
}
