import type { StoreSaveResult } from "@andornaut/game-kit/runtime/save/saveStore";

import type { AchievementId, Rect, SkillId, ZoneLayout } from "../data/types/index.ts";
import {
  allPowerUpsUnlocked,
  allZonesUnlocked,
  beginDevelopmentSession,
  developmentSkillOverrides,
  endDevelopmentSession,
  isDevelopmentSession,
} from "../dev/mode.ts";
import type {
  AchievementEntry,
  Progress,
  QueuedTip,
  RunStatsSummary,
  WholeRunStatsSummary,
  ZoneStatsSummary,
} from "../progress/index.ts";
import * as pageSave from "../progress/save/pageSave.ts";
import { activeStepSeconds } from "../rules/death.ts";
import { areaOf, type ZoneState } from "../rules/zone.ts";
import { zoneStepRecord } from "../rules/zoneRecords.ts";
import { stepTips, tipsInView } from "../rules/zoneTips.ts";

export type { Progress };

// The page's save calls with this page's cheat session bound, so scenes call them without a
// session. The session is asked at each call, as a cheat can start it mid-page.
const SESSION: pageSave.SaveSession = {
  development: isDevelopmentSession,
  powerUpsUnlocked: allPowerUpsUnlocked,
  skillOverrides: developmentSkillOverrides,
};

// Every cheat calls this first: the first starts the cheat session, which holds the save so that
// nothing is saved, earned or banked until it ends.
export function startCheatSession(): void {
  if (!isDevelopmentSession()) {
    pageSave.holdSave();
    beginDevelopmentSession();
  }
}

// Returning to the start screen from play ends the cheat session: every cheat turns off and the
// save is back as it was before the first cheat, so Continue loads that.
export function endCheatSession(): void {
  if (isDevelopmentSession()) {
    endDevelopmentSession();
    pageSave.releaseSave();
  }
}

// Whether the map opens every zone and stage (Unlock all zones).
export function mapFullyOpen(): boolean {
  return allZonesUnlocked();
}

// The tools, which start no cheat session and write the save.
export function clearSeenTips(): Promise<StoreSaveResult> {
  return pageSave.clearSeenTips();
}
export function resetSave(): Promise<StoreSaveResult> {
  return pageSave.resetSave();
}

export function probeSaveAge(): ReturnType<typeof pageSave.probeSaveAge> {
  return pageSave.probeSaveAge();
}

export function loadProgress(): Promise<pageSave.SaveAge> {
  return pageSave.loadProgress(SESSION);
}
export function beginZoneVisit(zone: string): void {
  pageSave.beginZoneVisit(zone);
}
export function beginStageRun(stage: string): void {
  pageSave.beginStageRun(SESSION, stage);
}
export function retryStageRun(stage: string): void {
  pageSave.retryStageRun(stage);
}
export function completeStageRun(stage: string): RunStatsSummary {
  return pageSave.completeStageRun(stage);
}
export function stageRunStats(stage: string): RunStatsSummary {
  return pageSave.stageRunStats(stage);
}
export function zoneVisitStats(zone: string): ZoneStatsSummary {
  return pageSave.zoneVisitStats(zone);
}
export function activeStageTime(stage: string): number {
  return pageSave.activeStageTime(stage);
}
export function recordActiveStageStep(
  stage: string,
  seconds: number,
  before: ZoneState,
  after: ZoneState,
): void {
  pageSave.recordActiveStageStep(
    stage,
    () => activeStepSeconds(seconds, before, after),
    before.death === undefined && after.death !== undefined,
  );
}
// Active seconds spent in a room behind one of stage's doors, on the same clock as live steps.
export function recordRoomTime(stage: string, seconds: number): void {
  pageSave.recordActiveStageStep(stage, () => seconds, false);
}
// The escapes and skill use of one live step in layout, for the achievements.
export function recordStepAchievements(
  layout: ZoneLayout,
  stage: string,
  before: ZoneState,
  after: ZoneState,
): void {
  const { escaped, skillUsed } = zoneStepRecord(before, after);
  const objects = areaOf(layout, before.area).objects;
  pageSave.recordStageStepAchievements(SESSION, stage, {
    escaped: escaped.map((index) => objects[index]!.character),
    skillUsed,
  });
}
export function recordStageChunks(stage: string, middle: readonly string[]): void {
  pageSave.recordStageChunks(SESSION, stage, middle);
}
export function recentStageChunks(stage: string): readonly string[] {
  return pageSave.recentStageChunks(stage);
}
export function savedRecentMiddleChunks(zone: string): readonly string[] {
  return pageSave.savedRecentMiddleChunks(zone);
}
export function nextTip(blocked: () => boolean): QueuedTip | undefined {
  return pageSave.nextTip(SESSION, blocked);
}
// The tips live steps from before to after and the view after them trigger: a boss acquiring him
// (stepTips), and a room door or red hazard in view, a rect in the area's pixels (tipsInView).
export function triggerZoneTips(
  layout: ZoneLayout,
  view: Rect,
  before: ZoneState,
  after: ZoneState,
): void {
  const area = areaOf(layout, after.area);
  pageSave.triggerTips([...stepTips(area, before, after), ...tipsInView(area, after, view)]);
}
export function nextAchievementNotice(blocked: () => boolean): AchievementId | undefined {
  return pageSave.nextAchievementNotice(blocked);
}
export function achievementCard(): AchievementEntry[] {
  return pageSave.achievementCard();
}
export function clearStageTime(stage: string): void {
  pageSave.clearStageTime(stage);
}
export function flushStats(): Promise<void> {
  return pageSave.flushStats();
}
// Update now's save: the statistics flushed and every pending progress write settled.
export function settleSaves(): Promise<void> {
  return pageSave.settleWrites();
}
export function wholeRunStats(): WholeRunStatsSummary {
  return pageSave.wholeRunStats();
}
export function resetWholeRunStats(): void {
  pageSave.resetWholeRunStats();
}
export function savedSkills(): readonly SkillId[] {
  return pageSave.savedSkills(SESSION);
}
export function activeSkill(): SkillId | null {
  return pageSave.activeSkill(SESSION);
}
export function selectActiveSkill(skill: SkillId | null): boolean {
  return pageSave.selectActiveSkill(SESSION, skill);
}
export function grantSkill(skill: SkillId): boolean {
  return pageSave.grantSkill(SESSION, skill);
}
export function savedProgress(): Progress {
  return pageSave.savedProgress();
}
export function savedMap(): ReturnType<typeof pageSave.savedMap> {
  return pageSave.savedMap();
}
export function saveOpeningSeen(): void {
  pageSave.saveOpeningSeen(SESSION);
}
export function seenZoneIntros(): readonly string[] {
  return pageSave.seenZoneIntros();
}
export function saveZoneIntro(zone: string): void {
  pageSave.saveZoneIntro(SESSION, zone);
}
export function saveStand(stand: string): void {
  pageSave.saveStand(SESSION, stand);
}
export function saveCompleted(node: string): void {
  pageSave.saveCompleted(SESSION, node);
}
export function clearProgress(): void {
  pageSave.clearProgress(SESSION);
}
