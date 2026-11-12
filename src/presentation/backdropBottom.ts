import type { Rect } from "../data/types/index.ts";

export function backdropBottomRect(
  view: Pick<Rect, "height" | "y">,
  bounds: Rect,
): Rect | undefined {
  const y = Math.max(bounds.y + bounds.height, view.y);
  const height = view.y + view.height - y;
  return height > 0 ? { height, width: bounds.width, x: bounds.x, y } : undefined;
}
