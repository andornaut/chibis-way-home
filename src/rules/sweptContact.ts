import type { Point, Rect } from "../data/types";
import { overlaps } from "./rect";

// A positive interval of relative swept overlap catches contact between fixed frames without
// treating an edge graze or a diagonal bounding-box overlap as a collision.
export function sweptContact(a: Rect, aEnd: Point, b: Rect, bEnd: Point): boolean {
  if (overlaps(a, b)) {
    return true;
  }
  let enter = 0;
  let leave = 1;
  for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? "width" : "height";
    const velocity = aEnd[axis] - a[axis] - (bEnd[axis] - b[axis]);
    if (velocity === 0) {
      if (a[axis] >= b[axis] + b[size] || b[axis] >= a[axis] + a[size]) {
        return false;
      }
      continue;
    }
    const first = (b[axis] - a[axis] - a[size]) / velocity;
    const last = (b[axis] + b[size] - a[axis]) / velocity;
    enter = Math.max(enter, Math.min(first, last));
    leave = Math.min(leave, Math.max(first, last));
  }
  return enter < leave;
}
