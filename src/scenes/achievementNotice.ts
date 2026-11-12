import type { Scene } from "phaser";

import type { AchievementNoticeScene } from "./AchievementNoticeScene.ts";
import { modalInput } from "./modalInput.ts";
import type { ZoneBarkScene } from "./ZoneBarkScene.ts";
import type { ZoneScene } from "./ZoneScene.ts";

export const ACHIEVEMENT_NOTICE = "achievementNotice";

// Scenes that defer unlock notices while they run or are paused: the cinematics, full screens
// and modal cards.
export const NOTICE_BLOCKING_SCENES: ReadonlySet<string> = new Set([
  "achievements",
  "boot",
  "celebration",
  "cutscene",
  "death",
  "dialogue",
  "dialogueChoice",
  "opening",
  "restart",
  "room",
  "settings",
  "skillDetail",
  "stageSelect",
  "update",
  "zoneDeparture",
  "zoneIntroduction",
]);

// Scenes whose running alone does not defer a notice: the notice itself, the start screen and
// the map, the pause scene, whose card holds the modal gate, the barks while idle, and the zone
// unless it is covered or ending (ZoneScene.noticeBlocked).
export const NOTICE_CHECKED_SCENES: ReadonlySet<string> = new Set([
  ACHIEVEMENT_NOTICE,
  "map",
  "pause",
  "start",
  "zone",
  "zoneBark",
]);

const running = (scene: Scene, key: string) =>
  scene.scene.isActive(key) || scene.scene.isPaused(key);

// Whether an unlock notice must wait: a modal card holds input, a blocking scene runs, a bark is
// queued or showing, or the zone is covered or ending.
export function noticeBlocked(scene: Scene): boolean {
  if (!modalInput(scene).accepts()) {
    return true;
  }
  if ([...NOTICE_BLOCKING_SCENES].some((key) => running(scene, key))) {
    return true;
  }
  if (running(scene, "zoneBark") && !(scene.scene.get("zoneBark") as ZoneBarkScene).idle()) {
    return true;
  }
  return running(scene, "zone") && (scene.scene.get("zone") as ZoneScene).noticeBlocked();
}

// Whether an unlock notice shows now, so barks wait for it.
export function achievementNoticeShowing(scene: Scene): boolean {
  return (
    scene.scene.isActive(ACHIEVEMENT_NOTICE) &&
    (scene.scene.get(ACHIEVEMENT_NOTICE) as AchievementNoticeScene).showing()
  );
}
