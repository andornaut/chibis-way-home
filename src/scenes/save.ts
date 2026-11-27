import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";

import type { Rect, ZoneLayout } from "../data/types/index.ts";
import type { Progress } from "../progress/index.ts";
import {
  activeStepSeconds,
  areaOf,
  stepTips,
  tipsInView,
  type ZoneState,
  zoneStepRecord,
} from "../rules/zone/index.ts";
import { createPageSave, type PageSave, type SaveAge } from "../save/index.ts";

export type { Progress };

/**
 * The scenes' save operations over one page save: its own, and those that read a zone step for
 * it.
 */
export function createSave(page: PageSave) {
  return {
    ...page,
    // Whether the map opens every zone and stage (Unlock all zones).
    mapFullyOpen(): boolean {
      return page.savedProgress().allZonesUnlocked;
    },
    probeSaveAge(): Promise<SaveAge | "unavailable"> {
      return page.probeSaveAge();
    },
    recordActiveStageStep(
      stage: string,
      seconds: number,
      before: ZoneState,
      after: ZoneState,
    ): void {
      page.recordActiveStageStep(
        stage,
        () => activeStepSeconds(seconds, before, after),
        before.death === undefined && after.death !== undefined,
      );
    },
    // Active seconds spent in a room behind one of stage's doors, on the same clock as live steps.
    recordRoomTime(stage: string, seconds: number): void {
      page.recordActiveStageStep(stage, () => seconds, false);
    },
    // The escapes and skill use of one live step in layout, for the achievements.
    recordStepAchievements(
      layout: ZoneLayout,
      stage: string,
      before: ZoneState,
      after: ZoneState,
    ): void {
      const { escaped, skillUsed } = zoneStepRecord(before, after);
      const objects = areaOf(layout, before.area).objects;
      page.recordStageStepAchievements(stage, {
        escaped: escaped.map((index) => objects[index]!.character),
        skillUsed,
      });
    },
    resetSaveAvailable(): Promise<boolean> {
      return page.resetSaveAvailable();
    },
    // Update now's save: the statistics flushed and every pending progress write settled.
    settleSaves(): Promise<void> {
      return page.settleWrites();
    },
    // The tips live steps from before to after and the view after them trigger: a boss acquiring
    // him (stepTips), and a room door or red hazard in view, a rect in the area's pixels
    // (tipsInView).
    triggerZoneTips(layout: ZoneLayout, view: Rect, before: ZoneState, after: ZoneState): void {
      const area = areaOf(layout, after.area);
      page.triggerTips([...stepTips(area, before, after), ...tipsInView(area, after, view)]);
    },
    // The cheat that saves, as normal play does (gameplay/cheats.md).
    unlockAllPowerUps(): void {
      page.grantAllSkills();
    },
  };
}

// Flushes as the page is hidden or left. False where there is no page to watch.
function watchPageLeaving(flush: () => void): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  });
  return true;
}

// The page's one save, over its localStorage. Nothing is read until loadProgress.
const save = createSave(createPageSave(localSaveStorage(), watchPageLeaving));

export const {
  achievementCard,
  activeSkill,
  activeStageTime,
  beginStageRun,
  beginZoneVisit,
  clearProgress,
  clearStageTime,
  commitStageGift,
  completeRunLinkStage,
  completeStageRun,
  flushStats,
  grantSkill,
  loadProgress,
  mapFullyOpen,
  nextAchievementNotice,
  nextTip,
  prepareStageGift,
  probeSaveAge,
  recentStageChunks,
  recordActiveStageStep,
  recordRoomTime,
  recordStageChunks,
  recordStepAchievements,
  resetSave,
  resetSaveAvailable,
  resetWholeRunStats,
  retryStageRun,
  saveCompleted,
  saveOpeningSeen,
  saveStand,
  saveZoneIntro,
  savedMap,
  savedProgress,
  savedRecentMiddleChunks,
  savedSkills,
  seenZoneIntros,
  selectActiveSkill,
  settleSaves,
  stageRunStats,
  triggerZoneTips,
  unlockAllPowerUps,
  unlockAllZones,
  wholeRunStats,
  zoneVisitStats,
} = save;
