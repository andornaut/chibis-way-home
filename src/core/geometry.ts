import type { Point, Rect, Size } from "../data/types/index.ts";

// Pixels of rounding error allowed when a body stands exactly on an edge.
export const EDGE = 1e-6;

// Whether two rects match: exactly, or with every field finite and closer than tolerance.
export function sameRect(a: Rect, b: Rect, tolerance?: number): boolean {
  if (tolerance === undefined) {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  }
  return (["x", "y", "width", "height"] as const).every(
    (axis) =>
      Number.isFinite(a[axis]) &&
      Number.isFinite(b[axis]) &&
      Math.abs(a[axis] - b[axis]) < tolerance,
  );
}

// The rect of size with its top-left corner at point.
export function rectAt(size: Size, point: Point): Rect {
  return { ...point, height: size.height, width: size.width };
}
