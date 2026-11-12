import type { AirJumpCueTuning, Point, Rect } from "../data/types/index.ts";
import type { BirdState } from "../rules/bird.ts";

export interface AirJumpCue {
  readonly elapsedSeconds: number;
}

export function airJumpStarted(before: BirdState, after: BirdState): boolean {
  return (
    !before.airJumpUsed &&
    after.airJumpUsed &&
    !after.grounded &&
    after.vy < 0 &&
    !before.jumpHeld &&
    after.jumpHeld &&
    after.jumpFromY === before.y
  );
}

export function stepAirJumpCue(
  tuning: AirJumpCueTuning,
  seconds: number,
  before: BirdState,
  after: BirdState,
  cue: AirJumpCue | undefined,
): AirJumpCue | undefined {
  if (after.grounded) {
    return undefined;
  }
  if (airJumpStarted(before, after)) {
    return { elapsedSeconds: 0 };
  }
  if (cue === undefined) {
    return undefined;
  }
  const elapsedSeconds = cue.elapsedSeconds + seconds;
  return elapsedSeconds < tuning.durationSeconds ? { ...cue, elapsedSeconds } : undefined;
}

export function airJumpCue(
  tuning: AirJumpCueTuning,
  frame: Rect,
  vx: number,
  cue: AirJumpCue | undefined,
) {
  if (cue === undefined || cue.elapsedSeconds >= tuning.durationSeconds) {
    return [];
  }
  const age = cue.elapsedSeconds / tuning.durationSeconds;
  const x = Math.round(
    frame.x + frame.width / 2 + tuning.offset.x + Math.sign(vx) * tuning.forwardLead,
  );
  const y = Math.round(frame.y + frame.height / 2 + tuning.offset.y);
  const core = new Map<string, Point>();
  const pixel = (column: number, row: number) => {
    const left = x + Math.round((column - 8) * tuning.scale);
    const top = y + Math.round((row - 8) * tuning.scale);
    for (let dy = 0; dy < 2 * tuning.scale; dy++) {
      for (let dx = 0; dx < 2 * tuning.scale; dx++) {
        const at = { x: left + dx, y: top + dy };
        core.set(`${at.x},${at.y}`, at);
      }
    }
  };
  for (const top of [2, 9]) {
    pixel(7, top);
    for (let step = 1; step <= 4; step++) {
      pixel(7 - step, top + step);
      pixel(7 + step, top + step);
    }
  }
  const border = new Map<string, Point>();
  for (const at of core.values()) {
    for (let dy = -tuning.borderThickness; dy <= tuning.borderThickness; dy++) {
      for (let dx = -tuning.borderThickness; dx <= tuning.borderThickness; dx++) {
        const point = { x: at.x + dx, y: at.y + dy };
        const key = `${point.x},${point.y}`;
        if (!core.has(key)) {
          border.set(key, point);
        }
      }
    }
  }
  return [
    ...[...border.values()].map((at) => ({ ...at, colour: tuning.borderColour })),
    ...[...core.values()].map((at) => ({ ...at, colour: tuning.colour })),
  ].map((at) => ({ ...at, alpha: 1 - age, height: 1, width: 1 }));
}
