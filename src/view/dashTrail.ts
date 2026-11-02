import { clamp01 } from "@andornaut/game-kit/numbers";

import type { DashTrailTuning, Rect } from "../data/types";
import type { BirdDashState } from "../rules/bird";

export interface DashTrailPixel extends Rect {
  readonly alpha: number;
  readonly colour: string;
}

// Every column is outside the full authored frame, behind the committed dash direction.
export function dashTrail(
  tuning: DashTrailTuning,
  durationSeconds: number,
  frame: Rect,
  dash: Pick<BirdDashState, "direction" | "remainingSeconds"> | undefined,
): readonly DashTrailPixel[] {
  if (
    dash === undefined ||
    dash.remainingSeconds <= 0 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return [];
  }
  const age = clamp01(1 - dash.remainingSeconds / durationSeconds);
  const pixels: DashTrailPixel[] = [];
  for (const line of tuning.lines) {
    const length = Math.max(1, Math.round(line.length * (1 - tuning.lengthDecay * age)));
    const strength = line.alpha * (1 - age) ** tuning.timeFadeExponent;
    for (let column = 0; column < length; column++) {
      const progress = column / Math.max(1, length - 1);
      pixels.push({
        alpha: Math.round(255 * strength * (1 - progress) ** tuning.tipFadeExponent),
        colour: line.colour,
        height: tuning.thickness,
        width: 1,
        x:
          dash.direction === 1
            ? frame.x - line.gap - 1 - column
            : frame.x + frame.width + line.gap + column,
        y: frame.y + line.y,
      });
    }
  }
  return pixels;
}
