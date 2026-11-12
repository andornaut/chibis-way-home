import type { Point, Rect, Size } from "../data/types/index.ts";

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

// Where copies of a wave repeat across a push volume, as top-left corners: as many whole copies as
// fit to the nearest count (at least one), spaced evenly from edge to edge, each bottom on the
// volume's bottom, the first at the source edge (the far side from facing).
export function forceVisualSpan(volume: Rect, wave: Size, facing: -1 | 1): readonly Point[] {
  const count = Math.max(1, Math.round(volume.width / wave.width));
  const step = count === 1 ? 0 : (volume.width - wave.width) / (count - 1);
  const y = volume.y + volume.height - wave.height;
  return Array.from({ length: count }, (_, index) => ({
    x: facing === 1 ? volume.x + index * step : volume.x + volume.width - wave.width - index * step,
    y,
  }));
}
