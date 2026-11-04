import { clamp01 } from "@andornaut/game-kit/numbers";

import type { DashTrailTuning, Rect } from "../data/types";
import type { BirdDashState } from "../rules/bird";

interface DashTrailPixel extends Rect {
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
  const borders: DashTrailPixel[] = [];
  const cores: DashTrailPixel[] = [];
  const border = tuning.borderThickness;
  const headEnd = tuning.headColumns - 1;
  for (const line of tuning.lines) {
    const length = Math.max(1, Math.round(line.length * (1 - tuning.lengthDecay * age)));
    const strength = line.alpha * (1 - tuning.headDecay * age);
    const alpha = (plateau: number, column: number) =>
      Math.round(
        255 *
          strength *
          (1 - clamp01((column - plateau) / Math.max(1, length - headEnd))) **
            tuning.tipFadeExponent,
      );
    const x = (gap: number, column: number) =>
      dash.direction === 1 ? frame.x - gap - 1 - column : frame.x + frame.width + gap + column;
    for (let column = 0; column < length + 2 * border; column++) {
      borders.push({
        alpha: alpha(headEnd + border, column),
        colour: tuning.borderColour,
        height: tuning.thickness + 2 * border,
        width: 1,
        x: x(line.gap, column),
        y: frame.y + line.y - border,
      });
    }
    for (let column = 0; column < length; column++) {
      cores.push({
        alpha: alpha(headEnd, column),
        colour: line.colour,
        height: tuning.thickness,
        width: 1,
        x: x(line.gap + border, column),
        y: frame.y + line.y,
      });
    }
  }
  return [...borders, ...cores];
}
