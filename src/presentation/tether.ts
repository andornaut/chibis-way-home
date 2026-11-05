import type { Point } from "../data/types";

export interface TetherSegment {
  readonly tag: "cable" | "hook";
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
