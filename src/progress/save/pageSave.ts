import { CelebrationQueue } from "@andornaut/game-kit/achievements";
import { saveStore } from "@andornaut/game-kit/save/saveStore";
import { loadSave } from "@andornaut/game-kit/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/web/save/dom/localSaveStorage";

import { BOSS_CHARACTERS } from "../../data/achievements";
import { CHUNKS } from "../../data/chunks";
import { ZONE_MAP } from "../../data/map";
import type { AchievementId, BossId, SkillId } from "../../data/types";
import { RECIPES } from "../../data/zones";
import {
  ACHIEVEMENT_IDS,
  achievementEntries,
  type AchievementEntry,
  type AchievementFacts,
  type AchievementScope,
  earnedAt,
  zoneEndingAt,
} from "../achievements";
import { recentMiddleChunks, withRecentMiddleChunks } from "../recentChunks";
import { eligibleSkills, resolveActiveSkill, type SkillOverrides } from "../skills";
import { achievementsStore } from "./achievements";
import {
  BEGINNING,
  mapProgress,
  type Progress,
  progressFormat,
  type RecentChunks,
} from "./progress";
import {
  type RunStatsSummary,
  stageStatsStore,
  type WholeRunStatsSummary,
  type ZoneStatsSummary,
} from "./stats";

export { type Progress } from "./progress";

// The page's session, which each call that it changes takes first and asks when it needs to:
// in a developer session progress and statistics are read but never written, and the
// developer skill overrides enable skills beside the owned ones.
export interface SaveSession {
  readonly development: () => boolean;
  readonly skillOverrides: () => SkillOverrides;
}

const KEYS = { backup: "chibis-way-home.save-backup", save: "chibis-way-home.save" } as const;

const storage = localSaveStorage();
const format = progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS)));
const store = saveStore(storage, KEYS, format);
let progress: Progress = BEGINNING;
let developmentOwned: readonly SkillId[] | undefined;
let developmentSavedSelection: SkillId | null | undefined;
let temporarySelection: SkillId | null | undefined;
const STAGES = new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages));
const stats = stageStatsStore(localSaveStorage(), STAGES, ZONE_MAP.destinations);
let statsLifecycleInstalled = false;
const achievements = achievementsStore(localSaveStorage());
// Unlock notices not shown yet: the stored unannounced ones, then each award.
const notices = new CelebrationQueue<AchievementId>();
// The earned ids, including awards whose write is still queued, so a later call in the same
// frame does not award or announce them again.
let earnedIds: readonly AchievementId[] = [];
const BOSSES_BY_CHARACTER: ReadonlyMap<string, BossId> = new Map(
  Object.entries(BOSS_CHARACTERS).map(([boss, character]) => [character, boss as BossId]),
);

function installStatsLifecycle(session: SaveSession): void {
  if (statsLifecycleInstalled || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  statsLifecycleInstalled = true;
  window.addEventListener("pagehide", () => {
    void flushStats(session);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flushStats(session);
    }
  });
}

// Reads the stored progress into savedProgress.
export async function loadProgress(session: SaveSession): Promise<void> {
  if (session.development()) {
    try {
      const loaded = loadSave(format, await storage.read(KEYS.save));
      developmentOwned = loaded.status === "loaded" ? loaded.save.skills : [];
      developmentSavedSelection = loaded.status === "loaded" ? loaded.save.activeSkill : null;
    } catch {
      developmentOwned = [];
      developmentSavedSelection = null;
    }
    return;
  }
  const [loaded, , earned] = await Promise.all([store.load(), stats.load(), achievements.load()]);
  progress = loaded.save;
  if (progress.activeSkill === "speedy") {
    stats.useSkill();
  }
  earnedIds = earned.save.earned;
  notices.push(earned.save.unannounced);
  installStatsLifecycle(session);
}

// Judges each scope with its facts beside the shared profile, and stores and queues what they
// earn, in card order. Callers have already left developer sessions out.
function judgeAchievements(
  scopes: readonly (readonly [AchievementScope, Partial<AchievementFacts>])[],
): void {
  const profile = { skillUsed: stats.skillUsed(), skills: progress.skills };
  const found = new Set(
    scopes.flatMap(([scope, facts]) => earnedAt(earnedIds, scope, { ...profile, ...facts })),
  );
  const fresh = ACHIEVEMENT_IDS.filter((id) => found.has(id));
  if (fresh.length > 0) {
    earnedIds = [...earnedIds, ...fresh];
    notices.push(fresh);
    void achievements.award(fresh);
  }
}

// What a live step did for the records: the characters whose pursuit it ended in an escape, and
// whether it used a skill (zoneStepRecord).
export function recordStageStepAchievements(
  session: SaveSession,
  stage: string,
  step: { readonly escaped: readonly string[]; readonly skillUsed: boolean },
): void {
  if (session.development() || !STAGES.has(stage)) {
    return;
  }
  if (step.skillUsed) {
    stats.useSkill();
  }
  const bosses = [
    ...new Set(step.escaped.flatMap((character) => BOSSES_BY_CHARACTER.get(character) ?? [])),
  ];
  judgeAchievements(bosses.map((boss) => ["escape", { escaped: boss }] as const));
}

// The next unlock notice to show unless blocked, marked announced as it starts.
export function nextAchievementNotice(
  session: SaveSession,
  blocked: () => boolean,
): AchievementId | undefined {
  const id = notices.takeWhen(blocked);
  if (id !== undefined && !session.development()) {
    void achievements.announced(id);
  }
  return id;
}

// Every achievement for the card, in card order, with each locked entry's progress.
export function achievementCard(session: SaveSession): AchievementEntry[] {
  if (session.development()) {
    return achievementEntries([], { skillUsed: false, skills: [] });
  }
  const visit = stats.currentVisit();
  return achievementEntries(earnedIds, {
    skillUsed: stats.skillUsed(),
    skills: progress.skills,
    ...(visit && { visit }),
  });
}

export function beginZoneVisit(session: SaveSession, zone: string): void {
  if (session.development()) {
    return;
  }
  stats.beginVisit(zone);
}
export function beginStageRun(session: SaveSession, stage: string): void {
  if (session.development()) {
    return;
  }
  if (STAGES.has(stage)) {
    if (progress.at === "beginning") {
      writeStand(session, stage);
    }
    stats.beginRun(stage);
  }
}
export function retryStageRun(session: SaveSession, stage: string): void {
  if (session.development()) {
    return;
  }
  if (STAGES.has(stage)) {
    stats.retryStage(stage);
  }
}
export function completeStageRun(session: SaveSession, stage: string): RunStatsSummary {
  if (session.development()) {
    return stats.summary("");
  }
  const summary = stats.completeStage(stage);
  const zone = zoneEndingAt(ZONE_MAP, stage);
  const visit = stats.currentVisit();
  judgeAchievements([
    ["stage-clear", { stage: { attempts: summary.attempts, id: stage } }],
    ...(zone === undefined ? [] : [["zone-clear", { zone, ...(visit && { visit }) }] as const]),
  ]);
  return summary;
}
export function stageRunStats(session: SaveSession, stage: string): RunStatsSummary {
  return stats.summary(session.development() ? "" : stage);
}
export function zoneVisitStats(session: SaveSession, zone: string): ZoneStatsSummary {
  return stats.visitSummary(session.development() ? "" : zone);
}

export function activeStageTime(session: SaveSession, stage: string): number {
  return stats.seconds(session.development() ? "" : stage);
}

// A step's active seconds, and whether he died on it. Developer test chains have no persistent
// stage identity and do not write real-stage stats.
export function recordActiveStageStep(
  session: SaveSession,
  stage: string,
  active: () => number,
  died: boolean,
): void {
  if (!session.development() && STAGES.has(stage)) {
    const seconds = active();
    stats.addActiveTime(stage, seconds);
    if (seconds > 0 && died) {
      stats.recordDeath(stage);
    }
  }
}

export function clearStageTime(session: SaveSession, stage: string): void {
  if (session.development()) {
    return;
  }
  if (STAGES.has(stage)) {
    stats.clearStage(stage);
  }
}

export function flushStats(session: SaveSession): Promise<void> {
  return session.development() ? Promise.resolve() : stats.flush();
}

export function wholeRunStats(session: SaveSession): WholeRunStatsSummary {
  return session.development() ? { activeSeconds: 0, deaths: 0 } : stats.wholeRun();
}

export function resetWholeRunStats(session: SaveSession): void {
  if (session.development()) {
    return;
  }
  stats.resetWholeRun();
  void stats.flush();
}

export function savedSkills(): readonly SkillId[] {
  return developmentOwned ?? progress.skills;
}

export function activeSkill(session: SaveSession): SkillId | null {
  const eligible = eligibleSkills(session.skillOverrides(), savedSkills());
  if (!session.development()) {
    return resolveActiveSkill(eligible, progress.activeSkill);
  }
  const saved =
    developmentSavedSelection === undefined ? progress.activeSkill : developmentSavedSelection;
  temporarySelection = resolveActiveSkill(
    eligible,
    temporarySelection === undefined ? saved : temporarySelection,
  );
  return temporarySelection;
}

export function selectActiveSkill(session: SaveSession, skill: SkillId): boolean {
  const eligible = eligibleSkills(session.skillOverrides(), savedSkills());
  if (!eligible.includes(skill) || activeSkill(session) === skill) {
    return false;
  }
  if (session.development()) {
    temporarySelection = skill;
  } else {
    write(session, { ...progress, activeSkill: skill });
  }
  return true;
}

export function grantSkill(session: SaveSession, skill: SkillId): boolean {
  if (session.development() || progress.skills.includes(skill)) {
    return false;
  }
  write(session, {
    ...progress,
    activeSkill: progress.activeSkill ?? skill,
    skills: [...progress.skills, skill],
  });
  judgeAchievements([["skill", {}]]);
  return true;
}

// The saved progress, or the beginning.
export function savedProgress(): Progress {
  return progress;
}

// Where he is on the map: the zones he has completed and the zone node he stands on, the
// map's start with nothing completed from the beginning.
export function savedMap(): { readonly completed: readonly string[]; readonly stand: string } {
  return mapProgress(ZONE_MAP, progress);
}

export function saveOpeningSeen(session: SaveSession): void {
  write(session, { ...progress, openingSeen: true });
}

// The saved recent middle chunks, as a field to keep in the next map progress.
function savedRecent(): { readonly recent?: RecentChunks } {
  return progress.at === "map" && progress.recent !== undefined ? { recent: progress.recent } : {};
}

// The middle chunk ids of the zone's latest stage entries (recentMiddleChunks).
export function savedRecentMiddleChunks(zone: string): readonly string[] {
  return recentMiddleChunks(progress, zone);
}

// A fresh entry of a catalogued stage, after assembly, with its plan's middle chunk ids: the
// stage's destination remembers them as its newest entry. Developer sessions write nothing.
export function recordStageChunks(
  session: SaveSession,
  stage: string,
  middle: readonly string[],
): void {
  const zone = ZONE_MAP.destinations.find(({ stages }) => stages.includes(stage))?.id;
  if (session.development() || zone === undefined || progress.at !== "map") {
    return;
  }
  write(session, withRecentMiddleChunks(zone, middle, progress));
}

export function seenZoneIntros(): readonly string[] {
  return progress.at === "map" ? progress.seenZoneIntros : [];
}

export function saveZoneIntro(session: SaveSession, zone: string): void {
  const seen = seenZoneIntros();
  if (seen.includes(zone)) {
    return;
  }
  write(session, {
    activeSkill: progress.activeSkill,
    at: "map",
    ...savedMap(),
    openingSeen: progress.openingSeen,
    ...savedRecent(),
    seenZoneIntros: [...seen, zone],
    skills: progress.skills,
  });
}

// Map browsing updates an existing game; only actual stage entry starts a new one.
export function saveStand(session: SaveSession, stand: string): void {
  if (session.development()) {
    return;
  }
  void flushStats(session);
  if (progress.at !== "beginning") {
    writeStand(session, stand);
  }
}

function writeStand(session: SaveSession, stand: string): void {
  write(session, {
    activeSkill: progress.activeSkill,
    at: "map",
    completed: savedMap().completed,
    openingSeen: progress.openingSeen,
    ...savedRecent(),
    seenZoneIntros: seenZoneIntros(),
    skills: progress.skills,
    stand,
  });
}

// He has completed the zone at node: it opens the map past it, and he stands on it.
export function saveCompleted(session: SaveSession, node: string): void {
  const { completed } = savedMap();
  write(session, {
    activeSkill: progress.activeSkill,
    at: "map",
    completed: completed.includes(node) ? completed : [...completed, node],
    openingSeen: progress.openingSeen,
    ...savedRecent(),
    seenZoneIntros: seenZoneIntros(),
    skills: progress.skills,
    stand: node,
  });
}

function write(session: SaveSession, next: Progress): void {
  if (session.development()) {
    return;
  }
  progress = next;
  if (next.activeSkill === "speedy") {
    stats.useSkill();
  }
  void store.save(next);
}

// Restart: progress goes back to the beginning, and the map opens on the first zone with nothing
// completed. Only progress is cleared.
export function clearProgress(session: SaveSession): void {
  if (session.development()) {
    return;
  }
  void flushStats(session);
  write(session, BEGINNING);
}
