import { clamp01 } from "@andornaut/game-kit/numbers";

import { EDGE, rectAt } from "../core";
import type { BirdTuning, Point, Rect, ZoneLayout } from "../data/types";
import { clockPresent } from "./effectiveCollision";
import type { ZoneState } from "./zone";
import { supportPresent } from "./zoneCrumbling";

// The nearest top below a body at position in the frozen world. A void has no support; a
// presentation may use its visible fallback without adding collision terrain.
export function deathSupport(
  tuning: BirdTuning,
  layout: ZoneLayout,
  zone: ZoneState,
  position: Point,
): Rect | undefined {
  const area = layout.areas[zone.area];
  if (!area) {
    throw new Error(`No area ${zone.area}`);
  }
  const supports = [
    ...area.solids.filter((solid) => supportPresent(zone.crumbling, solid)),
    ...area.objects.flatMap((object, index) => {
      const at = zone.objects[index];
      return at &&
        (object.collision === "solid" || object.collision === "ledge") &&
        supportPresent(zone.crumbling, object) &&
        clockPresent(object, zone.behaviours[index])
        ? [rectAt(object, at)]
        : [];
    }),
  ];
  return supports
    .filter(
      (rect) =>
        rect.y >= position.y + tuning.height - EDGE &&
        rect.x < position.x + tuning.width &&
        position.x < rect.x + rect.width,
    )
    .sort((a, b) => a.y - b.y)[0];
}

// Current distance from the checkpoint to the exit, never a furthest-position record.
export function attemptProgress(startX: number, endX: number, currentX: number): number {
  if (![startX, endX, currentX].every(Number.isFinite) || endX <= startX) {
    throw new Error("Invalid attempt progress bounds");
  }
  return clamp01((currentX - startX) / (endX - startX));
}

// Only an actual active physics step counts. Paused scenes, dialogue, presentation and modal
// holds do not advance steps; the step that reaches a hazard or exit still counts its play.
export function activeStepSeconds(seconds: number, before: ZoneState, after: ZoneState): number {
  return Number.isFinite(seconds) &&
    seconds > 0 &&
    before.death === undefined &&
    !before.cleared &&
    !before.turnedBack &&
    before.door === undefined &&
    after.steps > before.steps
    ? seconds
    : 0;
}
