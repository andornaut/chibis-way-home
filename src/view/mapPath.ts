import { clamp } from "@andornaut/game-kit/numbers";

import type { Point, Rect } from "../data/types";

// A path on the map: a quadratic Bezier from one node's centre to the next.
export interface Curve {
  readonly control: Point;
  readonly from: Point;
  readonly to: Point;
}

// How a path is inked: squares width wide stamped every step px along it, solid, dashed (on and
// off count the stamps' centres, in px), or as dots, one at each end and the rest spaced evenly,
// about every px apart.
export type PathStroke =
  | { readonly kind: "dashes"; readonly off: number; readonly on: number; readonly width: number }
  | { readonly kind: "dots"; readonly every: number; readonly width: number }
  | { readonly kind: "solid"; readonly width: number };

// A path's ends: each node's centre, and how far from it the path stops.
export interface PathEnds {
  readonly from: Point;
  readonly fromTrim: number;
  readonly to: Point;
  readonly toTrim: number;
}

// Points sampled evenly in t along a curve, each with the arc length up to it.
interface Arc {
  readonly lengths: readonly number[];
  readonly points: readonly Point[];
}

const SAMPLES = 1024;

// The curve from one centre to the next, its control point the chord's midpoint pushed sideways
// by bend times the chord's length: to the left of travel for an even index, the right for odd.
export function bentCurve(bend: number, from: Point, to: Point, index: number): Curve {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const side = index % 2 === 0 ? 1 : -1;
  return {
    control: {
      x: (from.x + to.x) / 2 + side * bend * dy,
      y: (from.y + to.y) / 2 - side * bend * dx,
    },
    from,
    to,
  };
}

function pointAt({ control, from, to }: Curve, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

function arcOf(curve: Curve): Arc {
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) => pointAt(curve, i / SAMPLES));
  let length = 0;
  const lengths = points.map((point, i) => {
    const before = points[i - 1];
    length += before ? Math.hypot(point.x - before.x, point.y - before.y) : 0;
    return length;
  });
  return { lengths, points };
}

// The point s px along an arc.
function along({ lengths, points }: Arc, s: number): { point: Point } {
  let low = 1;
  let high = SAMPLES;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((lengths[mid] ?? 0) < s) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  const i = low;
  const a = points[i - 1] ?? { x: 0, y: 0 };
  const b = points[i] ?? a;
  const start = lengths[i - 1] ?? 0;
  const span = (lengths[i] ?? start) - start;
  const k = span === 0 ? 0 : (s - start) / span;
  return { point: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k } };
}

// The first arc length at which the curve is at least far from centre, searching from one end.
function trimAt(arc: Arc, centre: Point, far: number, fromEnd: boolean): number {
  const total = arc.lengths.at(-1) ?? 0;
  const distance = (s: number) => {
    const { point } = along(arc, fromEnd ? total - s : s);
    return Math.hypot(point.x - centre.x, point.y - centre.y);
  };
  let low = 0;
  let high = total;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (distance(mid) < far) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return fromEnd ? total - high : high;
}

// A width x width square centred on a point, snapped to whole pixels.
export function stampAt(width: number, { x, y }: Point): Rect {
  const corner = (centre: number) => Math.floor(centre - width / 2 + 0.5);
  return { height: width, width, x: corner(x), y: corner(y) };
}

// Whether the stamp distance px along a dashed path inks.
export function dashInks(on: number, off: number, distance: number): boolean {
  return distance % (on + off) <= on;
}

// The squares that ink a path along curve between its trimmed ends, stamped every step px. Each
// square once.
export function pathRects(step: number, stroke: PathStroke, ends: PathEnds, curve: Curve): Rect[] {
  const arc = arcOf(curve);
  const start = trimAt(arc, ends.from, ends.fromTrim, false);
  const end = trimAt(arc, ends.to, ends.toTrim, true);
  const length = Math.max(0, end - start);
  const distances: number[] = [];
  if (stroke.kind === "dots") {
    // The trim search can leave the length just under a whole number of spacings; it counts as whole.
    const count = Math.floor(length / stroke.every + 1e-6) + 1;
    for (let i = 0; i < count; i++) {
      distances.push(count === 1 ? 0 : (length * i) / (count - 1));
    }
  } else {
    for (let i = 0; i * step <= length; i++) {
      const distance = i * step;
      if (stroke.kind === "solid" || dashInks(stroke.on, stroke.off, distance)) {
        distances.push(distance);
      }
    }
  }
  const rects = distances.map((distance) =>
    stampAt(stroke.width, along(arc, start + distance).point),
  );
  const seen = new Set<string>();
  return rects.filter((rect) => {
    const key = `${rect.x},${rect.y},${rect.width}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Reuse the inked route's arc sampling for constant-distance travel, prepared once per journey.
export function curveWalk(curve: Curve): {
  readonly length: number;
  readonly at: (distance: number) => Point;
} {
  const arc = arcOf(curve);
  const length = arc.lengths.at(-1) ?? 0;
  return { at: (distance) => along(arc, clamp(0, length, distance)).point, length };
}
