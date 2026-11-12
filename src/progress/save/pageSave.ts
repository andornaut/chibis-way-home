import { CelebrationQueue } from "@andornaut/game-kit/achievements";
import { saveStore } from "@andornaut/game-kit/save/saveStore";
import { localSaveStorage } from "@andornaut/game-kit/web/save/dom/localSaveStorage";

import { BOSS_CHARACTERS } from "../../data/achievements.ts";
import { CHUNKS } from "../../data/chunks.ts";
import { ZONE_MAP } from "../../data/map.ts";
import type { AchievementId, BossId, SkillId } from "../../data/types/index.ts";
import { RECIPES } from "../../data/zones.ts";
import {
  ACHIEVEMENT_IDS,
  achievementEntries,
  type AchievementEntry,
  type AchievementFacts,
  type AchievementScope,
  earnedAt,
  zoneEndingAt,
} from "../achievements.ts";
import { recentMiddleChunks, withRecentMiddleChunks } from "../recentChunks.ts";
import { eligibleSkills, resolveActiveSkill, type SkillOverrides } from "../skills.ts";
import { achievementsStore } from "./achievements.ts";
import {
  BEGINNING,
  mapProgress,
  type Progress,
  PROGRESS_KEYS,
  progressFormat,
  type RecentChunks,
} from "./progress.ts";
import { grantStoredSkills, type SavedSkillGrantResult } from "./savedSkillGrant.ts";
import { skillGrantEffects, withGrantedSkill } from "./skillGrant.ts";
import {
  type RunStatsSummary,
  stageStatsStore,
  type WholeRunStatsSummary,
  type ZoneStatsSummary,
} from "./stats.ts";

export { type Progress } from "./progress.ts";

// The page's session, which each call that asks it takes first: the developer skill overrides
// enable skills beside the owned ones, and a developer session's active skill may be a selection
// held for the page and never saved.
export interface SaveSession {
  readonly development: () => boolean;
  readonly skillOverrides: () => SkillOverrides;
}

const storage = localSaveStorage();
const format = progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS)));
const store = saveStore(storage, PROGRESS_KEYS, format);
let progress: Progress = BEGINNING;
// A developer session's selection of an enabled skill it does not own, held for the page.
let temporarySelection: SkillId | undefined;
// Each new grant's enable tip not shown yet, in grant order. They are not saved.
let skillTips: SkillId[] = [];
const STAGES = new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages));
const stats = stageStatsStore(localSaveStorage(), STAGES, ZONE_MAP.destinations);
let statsLifecycleInstalled = false;
let achievements = achievementsStore(localSaveStorage());
let achievementWrites = 0;
let progressWrites = 0;
const savedGrants = new Set<symbol>();
// Unlock notices not shown yet: the stored unannounced ones, then each award.
const notices = new CelebrationQueue<AchievementId>();
const deliveredNotices = new Set<AchievementId>();
// The earned ids, including awards whose write is still queued, so a later call in the same
// frame does not award or announce them again.
let earnedIds: readonly AchievementId[] = [];
const BOSSES_BY_CHARACTER: ReadonlyMap<string, BossId> = new Map(
  Object.entries(BOSS_CHARACTERS).map(([boss, character]) => [character, boss as BossId]),
);

function installStatsLifecycle(): void {
  if (statsLifecycleInstalled || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  statsLifecycleInstalled = true;
  window.addEventListener("pagehide", () => {
    void flushStats();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flushStats();
    }
  });
}

// Whether the saves on the device are this version's or older ("current"), or any was written by
// a newer version ("newer").
export type SaveAge = "current" | "newer";

// Reads the stored progress into savedProgress. Where a newer version wrote any store, it writes
// nothing, not even an older store's upgrade, and returns "newer" before the session begins.
export async function loadProgress(session: SaveSession): Promise<SaveAge> {
  const [loaded, earned] = await Promise.all([store.load(), achievements.load()]);
  const statsStatus = await stats.load(loaded.status !== "newer" && earned.status !== "newer");
  if ([loaded.status, statsStatus, earned.status].includes("newer")) {
    return "newer";
  }
  progress = loaded.save;
  if (activeSkill(session) === "speedy") {
    stats.useSkill();
  }
  earnedIds = earned.save.earned;
  notices.push(earned.save.unannounced);
  installStatsLifecycle();
  return "current";
}

// Judges each scope with its facts beside the shared profile, and stores and queues what they
// earn, in card order.
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
    achievementWrites++;
    void achievements.award(fresh).finally(() => {
      achievementWrites--;
    });
  }
}

// What a live step did for the records: the characters whose pursuit it ended in an escape, and
// whether it used a skill (zoneStepRecord).
export function recordStageStepAchievements(
  session: SaveSession,
  stage: string,
  step: { readonly escaped: readonly string[]; readonly skillUsed: boolean },
): void {
  if (!STAGES.has(stage)) {
    return;
  }
  if (step.skillUsed || activeSkill(session) === "speedy") {
    stats.useSkill();
  }
  const bosses = [
    ...new Set(step.escaped.flatMap((character) => BOSSES_BY_CHARACTER.get(character) ?? [])),
  ];
  judgeAchievements(bosses.map((boss) => ["escape", { escaped: boss }] as const));
}

// The next unlock notice to show unless blocked, marked announced as it starts.
export function nextAchievementNotice(blocked: () => boolean): AchievementId | undefined {
  const id = notices.takeWhen(blocked);
  if (id !== undefined) {
    deliveredNotices.add(id);
  }
  if (id !== undefined) {
    achievementWrites++;
    void achievements.announced(id).finally(() => {
      achievementWrites--;
    });
  }
  return id;
}

// Every achievement for the card, in card order, with each locked entry's progress.
export function achievementCard(): AchievementEntry[] {
  const visit = stats.currentVisit();
  return achievementEntries(earnedIds, {
    skillUsed: stats.skillUsed(),
    skills: progress.skills,
    ...(visit && { visit }),
  });
}

export function beginZoneVisit(zone: string): void {
  stats.beginVisit(zone);
}
export function beginStageRun(session: SaveSession, stage: string): void {
  if (STAGES.has(stage)) {
    if (progress.at === "beginning") {
      writeStand(session, stage);
    }
    stats.beginRun(stage);
  }
}
export function retryStageRun(stage: string): void {
  if (STAGES.has(stage)) {
    stats.retryStage(stage);
  }
}
export function completeStageRun(stage: string): RunStatsSummary {
  const summary = stats.completeStage(stage);
  const zone = zoneEndingAt(ZONE_MAP, stage);
  const visit = stats.currentVisit();
  judgeAchievements([
    ["stage-clear", { stage: { attempts: summary.attempts, id: stage } }],
    ...(zone === undefined ? [] : [["zone-clear", { zone, ...(visit && { visit }) }] as const]),
  ]);
  return summary;
}
export function stageRunStats(stage: string): RunStatsSummary {
  return stats.summary(stage);
}
export function zoneVisitStats(zone: string): ZoneStatsSummary {
  return stats.visitSummary(zone);
}

export function activeStageTime(stage: string): number {
  return stats.seconds(stage);
}

// A step's active seconds, and whether he died on it. Only catalogued stages have records.
export function recordActiveStageStep(stage: string, active: () => number, died: boolean): void {
  if (STAGES.has(stage)) {
    const seconds = active();
    stats.addActiveTime(stage, seconds);
    if (seconds > 0 && died) {
      stats.recordDeath(stage);
    }
  }
}

export function clearStageTime(stage: string): void {
  if (STAGES.has(stage)) {
    stats.clearStage(stage);
  }
}

export function flushStats(): Promise<void> {
  return stats.flush();
}

export function wholeRunStats(): WholeRunStatsSummary {
  return stats.wholeRun();
}

export function resetWholeRunStats(): void {
  stats.resetWholeRun();
  void stats.flush();
}

export function savedSkills(): readonly SkillId[] {
  return progress.skills;
}

// The selected skill while it is eligible, or none. A developer session's temporary selection
// holds while its override stays enabled; then the saved selection applies again.
export function activeSkill(session: SaveSession): SkillId | null {
  const eligible = eligibleSkills(session.skillOverrides(), savedSkills());
  const saved = resolveActiveSkill(eligible, progress.activeSkill);
  if (!session.development() || temporarySelection === undefined) {
    return saved;
  }
  temporarySelection = resolveActiveSkill(eligible, temporarySelection) ?? undefined;
  return temporarySelection ?? saved;
}

export function selectActiveSkill(session: SaveSession, skill: SkillId): boolean {
  const eligible = eligibleSkills(session.skillOverrides(), savedSkills());
  if (!eligible.includes(skill) || activeSkill(session) === skill) {
    return false;
  }
  if (!progress.skills.includes(skill)) {
    temporarySelection = skill;
    if (skill === "speedy") {
      stats.useSkill();
    }
  } else {
    temporarySelection = undefined;
    write(session, { ...progress, activeSkill: skill });
  }
  return true;
}

export function grantSkill(session: SaveSession, skill: SkillId): boolean {
  const next = withGrantedSkill(progress, skill);
  if (next === progress) {
    return false;
  }
  const effects = skillGrantEffects(earnedIds, stats.skillUsed(), next);
  write(session, next);
  skillTips.push(skill);
  if (effects.awarded.length > 0) {
    earnedIds = [...earnedIds, ...effects.awarded];
    notices.push(effects.awarded);
    achievementWrites++;
    void achievements.award(effects.awarded).finally(() => {
      achievementWrites--;
    });
  }
  return true;
}
export async function grantSavedSkills(context: {
  readonly available: () => boolean;
}): Promise<SavedSkillGrantResult> {
  if (
    savedGrants.size > 0 ||
    stats.pendingChanges() ||
    achievementWrites > 0 ||
    progressWrites > 0
  ) {
    return { reason: "pending_progress_writes", status: "blocked", writes: [], written: [] };
  }
  const expected = progress;
  const available = () =>
    context.available() &&
    progress === expected &&
    !stats.pendingChanges() &&
    achievementWrites === 0 &&
    progressWrites === 0;
  if (!available()) {
    return { reason: "action_unavailable", status: "blocked", writes: [], written: [] };
  }
  const token = Symbol("saved-skill-grant");
  savedGrants.add(token);
  try {
    return await grantStoredSkills(
      {
        available,
        committed: (snapshot) => {
          const owned = progress.skills;
          skillTips.push(...snapshot.progress.skills.filter((skill) => !owned.includes(skill)));
          progress = snapshot.progress;
          stats.acceptSavedSkillUse(snapshot.stats.wholeRun.skillUsed === true);
          earnedIds = snapshot.achievements.earned;
          notices.push(snapshot.achievements.unannounced.filter((id) => !deliveredNotices.has(id)));
          achievements = achievementsStore(localSaveStorage());
        },
      },
      storage,
    );
  } finally {
    savedGrants.delete(token);
  }
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

// The middle chunk ids a fresh entry of a catalogued stage avoids: its destination's recent ones.
export function recentStageChunks(stage: string): readonly string[] {
  const zone = ZONE_MAP.destinations.find(({ stages }) => stages.includes(stage))?.id;
  return zone === undefined ? [] : recentMiddleChunks(progress, zone);
}

// A fresh entry of a catalogued stage, after assembly, with its plan's middle chunk ids: the
// stage's destination remembers them as its newest entry.
export function recordStageChunks(
  session: SaveSession,
  stage: string,
  middle: readonly string[],
): void {
  const zone = ZONE_MAP.destinations.find(({ stages }) => stages.includes(stage))?.id;
  if (zone === undefined || progress.at !== "map") {
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
  void flushStats();
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
  progress = next;
  if (activeSkill(session) === "speedy") {
    stats.useSkill();
  }
  progressWrites++;
  void store.save(next).finally(() => {
    progressWrites--;
  });
}

// Restart: progress goes back to the beginning, and the map opens on the first zone with nothing
// completed. Only progress is cleared.
export function clearProgress(session: SaveSession): void {
  void flushStats();
  skillTips = [];
  write(session, BEGINNING);
}

// The next new grant's enable tip to show unless blocked, once every queued unlock notice has
// shown. A tip whose skill is selected by then is dropped.
export function nextSkillTip(session: SaveSession, blocked: () => boolean): SkillId | undefined {
  skillTips = skillTips.filter((skill) => skill !== activeSkill(session));
  if (skillTips.length === 0 || notices.pending().length > 0 || blocked()) {
    return undefined;
  }
  return skillTips.shift();
}
