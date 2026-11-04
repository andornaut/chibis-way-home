import type { SkillId } from "../data/types";
import { developmentSkillOverrides, isDevelopmentSession } from "../dev/mode";
import * as pageSave from "../progress";
import { activeStepSeconds } from "../rules/death";
import type { ZoneState } from "../rules/zone";

export type { Progress } from "../progress";

// The page's save calls with this page's developer session bound, so scenes call them without
// a session. The session is asked at each call, as developer activation can start mid-page.
const SESSION: pageSave.SaveSession = {
  development: isDevelopmentSession,
  skillOverrides: developmentSkillOverrides,
};

export function loadProgress(): Promise<void> {
  return pageSave.loadProgress(SESSION);
}
export function beginZoneVisit(zone: string): void {
  pageSave.beginZoneVisit(SESSION, zone);
}
export function beginStageRun(stage: string): void {
  pageSave.beginStageRun(SESSION, stage);
}
export function retryStageRun(stage: string): void {
  pageSave.retryStageRun(SESSION, stage);
}
export function completeStageRun(stage: string): pageSave.RunStatsSummary {
  return pageSave.completeStageRun(SESSION, stage);
}
export function stageRunStats(stage: string): pageSave.RunStatsSummary {
  return pageSave.stageRunStats(SESSION, stage);
}
export function zoneVisitStats(zone: string): pageSave.ZoneStatsSummary {
  return pageSave.zoneVisitStats(SESSION, zone);
}
export function activeStageTime(stage: string): number {
  return pageSave.activeStageTime(SESSION, stage);
}
export function recordActiveStageStep(
  stage: string,
  seconds: number,
  before: ZoneState,
  after: ZoneState,
): void {
  pageSave.recordActiveStageStep(
    SESSION,
    stage,
    () => activeStepSeconds(seconds, before, after),
    before.death === undefined && after.death !== undefined,
  );
}
export function clearStageTime(stage: string): void {
  pageSave.clearStageTime(SESSION, stage);
}
export function flushStats(): Promise<void> {
  return pageSave.flushStats(SESSION);
}
export function wholeRunStats(): pageSave.WholeRunStatsSummary {
  return pageSave.wholeRunStats(SESSION);
}
export function resetWholeRunStats(): void {
  pageSave.resetWholeRunStats(SESSION);
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
export function savedProgress(): pageSave.Progress {
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
