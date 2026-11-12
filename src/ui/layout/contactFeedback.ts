import { insetRect, ringRects } from "@andornaut/game-kit/rect";

import type { ContactCueTuning, Point, Rect, WorldShakeTuning } from "../../data/types/index.ts";

export function contactWorldOffset(tuning: WorldShakeTuning, elapsed: number): Point {
  let offset = 0;
  if (elapsed >= 0 && elapsed < tuning.firstOffMs) {
    offset = tuning.distance;
  } else if (elapsed >= tuning.secondOnMs && elapsed < tuning.secondOffMs) {
    offset = -tuning.distance;
  } else if (elapsed >= tuning.secondOffMs && elapsed < tuning.durationMs) {
    offset = Math.round(
      (-tuning.distance * (tuning.durationMs - elapsed)) / (tuning.durationMs - tuning.secondOffMs),
    );
  }
  return { x: offset, y: offset };
}

export function contactCueOn(
  tuning: WorldShakeTuning,
  cue: ContactCueTuning,
  still: boolean,
  elapsed: number,
): boolean {
  return (
    elapsed >= 0 &&
    elapsed < cue.durationMs &&
    (still ||
      elapsed < tuning.firstOffMs ||
      (elapsed >= tuning.secondOnMs && elapsed < tuning.secondOffMs))
  );
}

// Copies actual edge pixels into the maximum render-only displacement, including corners.
export function contactOverscan(distance: number, view: Rect) {
  const { height, width, x, y } = view;
  return [
    {
      source: { height, width: 1, x: 0, y: 0 },
      target: { height, width: distance, x: x - distance, y },
    },
    {
      source: { height, width: 1, x: width - 1, y: 0 },
      target: { height, width: distance, x: x + width, y },
    },
    {
      source: { height: 1, width, x: 0, y: 0 },
      target: { height: distance, width, x, y: y - distance },
    },
    {
      source: { height: 1, width, x: 0, y: height - 1 },
      target: { height: distance, width, x, y: y + height },
    },
    ...[0, width - 1].flatMap((sx) =>
      [0, height - 1].map((sy) => ({
        source: { height: 1, width: 1, x: sx, y: sy },
        target: {
          height: distance,
          width: distance,
          x: sx === 0 ? x - distance : x + width,
          y: sy === 0 ? y - distance : y + height,
        },
      })),
    ),
  ];
}

export function contactBorder(tuning: ContactCueTuning, view: Rect) {
  return {
    band: ringRects(tuning.borderWidth, view),
    keyline: ringRects(tuning.keylineWidth, insetRect(tuning.borderWidth, view)),
  };
}
