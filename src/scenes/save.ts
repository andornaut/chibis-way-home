import type { AchievementId, SkillId, ZoneLayout } from "../data/types/index.ts";
import { developmentSkillOverrides, isDevelopmentSession } from "../dev/mode.ts";
import type {
  AchievementEntry,
  Progress,
  RunStatsSummary,
  SavedSkillGrantResult,
  WholeRunStatsSummary,
  ZoneStatsSummary,
} from "../progress/index.ts";
import * as pageSave from "../progress/save/pageSave.ts";
import { activeStepSeconds } from "../rules/death.ts";
import { areaOf, type ZoneState } from "../rules/zone.ts";
import { zoneStepRecord } from "../rules/zoneRecords.ts";

export type { Progress };

// The page's save calls with this page's developer session bound, so scenes call them without
// a session. The session is asked at each call, as developer activation can start mid-page.
const SESSION: pageSave.SaveSession = {
  development: isDevelopmentSession,
  skillOverrides: developmentSkillOverrides,
};

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
export function wholeRunStats(): WholeRunStatsSummary {
  return pageSave.wholeRunStats();
}
export function resetWholeRunStats(): void {
  pageSave.resetWholeRunStats();
}
export function savedSkills(): readonly SkillId[] {
  return pageSave.savedSkills();
}
export function activeSkill(): SkillId | null {
  return pageSave.activeSkill(SESSION);
}
export function selectActiveSkill(skill: SkillId): boolean {
  return pageSave.selectActiveSkill(SESSION, skill);
}
export function grantSkill(skill: SkillId): boolean {
  return pageSave.grantSkill(SESSION, skill);
}
export function grantSavedSkills(context: {
  readonly available: () => boolean;
}): Promise<SavedSkillGrantResult> {
  return pageSave.grantSavedSkills(context);
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
