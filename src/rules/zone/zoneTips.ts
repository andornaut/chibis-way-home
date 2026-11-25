import { rectsOverlap } from "@andornaut/game-kit/runtime/rect";

import { BOSS_CHARACTERS } from "../../data/achievements.ts";
import type { AreaLayout, Rect } from "../../data/types/index.ts";
import type { ZoneState } from "./zone.ts";

const BOSSES: ReadonlySet<string> = new Set(Object.values(BOSS_CHARACTERS));

// The tips view, a rect in the area's pixels, offers: doors when a room door overlaps it, and
// hazards when a red hazard that is always lethal does (a timed hazard, red only in its active
// phase, does not count), each at its current position.
export function tipsInView(
  area: AreaLayout,
  zone: Pick<ZoneState, "objects">,
  view: Rect,
): ("doors" | "hazards")[] {
  let doors = false;
  let hazards = false;
  area.objects.forEach((object, index) => {
    const door = object.room !== undefined;
    const hazard = object.contactCue === "red-hazard" && object.phaseTiles === undefined;
    if ((door && !doors) || (hazard && !hazards)) {
      const at = zone.objects[index] ?? object.origin;
      if (rectsOverlap(view, { ...at, height: object.height, width: object.width })) {
        doors ||= door;
        hazards ||= hazard;
      }
    }
  });
  return [...(doors ? (["doors"] as const) : []), ...(hazards ? (["hazards"] as const) : [])];
}

// The tips live steps from before to after offer: bosses when a boss's pursuit acquires Chibi,
// while he stays in the area and alive.
export function stepTips(area: AreaLayout, before: ZoneState, after: ZoneState): "bosses"[] {
  if (after.death !== undefined || after.area !== before.area) {
    return [];
  }
  const acquired = after.behaviours.some((state, index) => {
    const pursuit = state?.pursuit;
    return (
      pursuit?.phase === "engaged" &&
      (pursuit.engagements ?? 0) > (before.behaviours[index]?.pursuit?.engagements ?? 0) &&
      BOSSES.has(area.objects[index]?.character ?? "")
    );
  });
  return acquired ? ["bosses"] : [];
}
