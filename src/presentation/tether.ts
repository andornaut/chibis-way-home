import type { ObjectLayout, Point } from "../data/types";

export interface TetherSegment {
  readonly tag: "cable" | "hook" | "idle";
  // The segment's top-left corner.
  readonly x: number;
  readonly y: number;
}

// The segments of a tether hanging from its rail's y to its anchor (the object's top centre), each
// size square and centred on the line, unrotated: cables end to end from the rail down, then the
// hook with its bottom on the anchor, drawn over the lowest cable where the length is not a whole
// number of segments. None while the anchor is less than one segment below the rail.
export function tetherSegments(
  size: number,
  railY: number,
  anchor: Point,
): readonly TetherSegment[] {
  const hookY = anchor.y - size;
  if (hookY < railY) {
    return [];
  }
  const x = anchor.x - size / 2;
  const segments: TetherSegment[] = [];
  for (let y = railY; y < hookY; y += size) {
    segments.push({ tag: "cable", x, y });
  }
  segments.push({ tag: "hook", x, y: hookY });
  return segments;
}

// The segments of a spoke from its pivot to its anchor (the object's top centre) at any angle, each
// size square, unrotated and centred on the line, size apart from the anchor back toward the
// pivot: as many whole segments as the length holds, the last half a segment from the anchor and
// any shortfall left at the pivot. None while the anchor is less than one segment from the pivot.
export function spokeSegments(size: number, pivot: Point, anchor: Point): readonly TetherSegment[] {
  const dx = pivot.x - anchor.x;
  const dy = pivot.y - anchor.y;
  const length = Math.hypot(dx, dy);
  const count = Math.floor(length / size);
  return Array.from({ length: count }, (_, index) => {
    const along = (size / 2 + index * size) / length;
    return {
      tag: "idle" as const,
      x: anchor.x + dx * along - size / 2,
      y: anchor.y + dy * along - size / 2,
    };
  }).reverse();
}

// Where a tether runs this frame: from its rail's y straight down to its anchor (the object's top
// centre), or from its orbit's pivot to the anchor at any angle.
export type TetherLine =
  | { readonly anchor: Point; readonly kind: "rail"; readonly railY: number }
  | { readonly anchor: Point; readonly kind: "pivot"; readonly pivot: Point };

// The line of the tether on object, placed at at, among its area's objects at positions (each
// one's top-left corner): to its rail, or to its orbit host's centre. None without a tether.
export function tetherLine(
  objects: readonly ObjectLayout[],
  positions: readonly Point[],
  object: ObjectLayout,
  at: Point,
): TetherLine | undefined {
  const tether = object.tether;
  if (!tether) {
    return undefined;
  }
  const anchor = { x: at.x + object.width / 2, y: at.y };
  if (tether.kind === "rail") {
    return { anchor, kind: "rail", railY: tether.y };
  }
  const index = object.orbit!.host;
  const host = objects[index]!;
  const origin = positions[index] ?? host.origin;
  return {
    anchor,
    kind: "pivot",
    pivot: { x: origin.x + host.width / 2, y: origin.y + host.height / 2 },
  };
}
