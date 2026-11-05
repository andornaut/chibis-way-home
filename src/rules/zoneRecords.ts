import { EDGE } from "../core";
import type { ZoneState } from "./zone";

// What one live step did that the achievement records count: the indices of the area's objects
// whose pursuit went from engaged to escaped, and whether he started a dash or used his air
// jump. An escape on a step that ends in his death, or that changes area, does not count; a
// boss's death ends its pursuit without an escape.
interface ZoneStepRecord {
  readonly escaped: readonly number[];
  readonly skillUsed: boolean;
}

export function zoneStepRecord(before: ZoneState, after: ZoneState): ZoneStepRecord {
  const dashStarted =
    (after.bird.dash?.remainingSeconds ?? 0) > EDGE &&
    (after.bird.dash?.remainingSeconds ?? 0) > (before.bird.dash?.remainingSeconds ?? 0);
  const skillUsed = dashStarted || (!before.bird.airJumpUsed && after.bird.airJumpUsed);
  if (after.death !== undefined || after.area !== before.area) {
    return { escaped: [], skillUsed };
  }
  const escaped: number[] = [];
  after.behaviours.forEach((state, index) => {
    if (
      state?.pursuit?.phase === "escaped" &&
      before.behaviours[index]?.pursuit?.phase === "engaged"
    ) {
      escaped.push(index);
    }
  });
  return { escaped, skillUsed };
}
