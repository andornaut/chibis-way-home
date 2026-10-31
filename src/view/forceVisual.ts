import type { Point, Size } from "../data/types";

// Frame offsets remain independent of the force's collision volume.
export function forceVisualPosition(
  actorFrame: Size,
  actorSize: Size,
  wave: Size,
  offset: Point,
  facing: -1 | 1,
  at: Point,
): Point {
  const left = at.x + (actorSize.width - actorFrame.width) / 2;
  return {
    x: left + (facing === 1 ? offset.x : actorFrame.width - offset.x - wave.width),
    y: at.y + actorSize.height - actorFrame.height + offset.y,
  };
}
