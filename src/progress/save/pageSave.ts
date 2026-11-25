import { CelebrationQueue } from "@andornaut/game-kit/runtime/achievements";
import { saveStore, type StoreSaveResult } from "@andornaut/game-kit/runtime/save/saveStore";
import type { SaveStorage } from "@andornaut/game-kit/runtime/save/storage";
import { loadSave, type SaveFormat } from "@andornaut/game-kit/runtime/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";

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
import { openMap } from "../map.ts";
import { recentMiddleChunks, withRecentMiddleChunks } from "../recentChunks.ts";
import { resolveActiveSkill, SKILL_IDS } from "../skills.ts";
import { type PlayTipId, type QueuedTip, seenTip } from "../tips.ts";
import { ACHIEVEMENT_KEYS, ACHIEVEMENTS_FORMAT, achievementsStore } from "./achievements.ts";
import {
  BEGINNING,
  mapProgress,
  type Progress,
  PROGRESS_KEYS,
  progressFormat,
  type RecentChunks,
} from "./progress.ts";
import { skillGrantEffects, withGrantedSkill } from "./skillGrant.ts";
import {
  hasRecordedStats,
  type RunStatsSummary,
  stageStatsStore,
  STATS_KEYS,
  statsFormat,
  type WholeRunStatsSummary,
  type ZoneStatsSummary,
} from "./stats.ts";

export { type Progress } from "./progress.ts";

const storage = localSaveStorage();
const format = progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS)));
const store = saveStore(storage, PROGRESS_KEYS, format);
let progress: Progress = BEGINNING;
// The first-time tips triggered and not shown yet, in trigger order. They are not saved; a tip is
// saved as seen once it starts.
let tips: QueuedTip[] = [];
const STAGES = new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages));
const stats = stageStatsStore(localSaveStorage(), STAGES, ZONE_MAP.destinations);
let statsLifecycleInstalled = false;
let achievements = achievementsStore(localSaveStorage());
// Unlock notices not shown yet: the stored unannounced ones, then each award.
let notices = new CelebrationQueue<AchievementId>();
// The earned ids, including awards whose write is still queued, so a later call in the same
// frame does not award or announce them again.
let earnedIds: readonly AchievementId[] = [];
// The progress and achievement writes not yet settled, which settleWrites waits for.
const writesInFlight = new Set<Promise<unknown>>();
const BOSSES_BY_CHARACTER: ReadonlyMap<string, BossId> = new Map(
  Object.entries(BOSS_CHARACTERS).map(([boss, character]) => [character, boss as BossId]),
);

function inFlight<T>(write: Promise<T>): Promise<T> {
  const tracked = write.finally(() => writesInFlight.delete(tracked));
  writesInFlight.add(tracked);
  return tracked;
}

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

// These reads do not call SaveStore.load, so even a corrupt record leaves its backup alone.
async function readStoredSave<S>(
  source: Pick<SaveStorage, "read">,
  format: SaveFormat<S>,
  key: string,
) {
  try {
    return loadSave(format, await source.read(key));
  } catch {
    return { status: "unavailable" } as const;
  }
}

async function probeStoredGame(
  source: Pick<SaveStorage, "read">,
): Promise<{ readonly age: SaveAge | "unavailable"; readonly canReset: boolean }> {
  const [player, earned, statistics] = await Promise.all([
    readStoredSave(source, format, PROGRESS_KEYS.save),
    readStoredSave(source, ACHIEVEMENTS_FORMAT, ACHIEVEMENT_KEYS.save),
    readStoredSave(source, statsFormat(STAGES, ZONE_MAP.destinations), STATS_KEYS.save),
  ]);
  const statuses = [player.status, earned.status, statistics.status];
  if (statuses.includes("newer")) {
    return { age: "newer", canReset: false };
  }
  if (statuses.includes("unavailable")) {
    return { age: "unavailable", canReset: false };
  }
  const canReset =
    (player.status === "loaded" &&
      (player.save.at === "map" ||
        player.save.allZonesUnlocked ||
        player.save.openingSeen ||
        player.save.skills.length > 0 ||
        player.save.seenTips.length > 0)) ||
    (earned.status === "loaded" && earned.save.earned.length > 0) ||
    (statistics.status === "loaded" && hasRecordedStats(statistics.save));
  return { age: "current", canReset };
}

export async function probeSaveAge(
  source: Pick<SaveStorage, "read"> = storage,
): Promise<SaveAge | "unavailable"> {
  return (await probeStoredGame(source)).age;
}

export async function resetSaveAvailable(
  source: Pick<SaveStorage, "read"> = storage,
): Promise<boolean> {
  return (await probeStoredGame(source)).canReset;
}

// Reads the stored progress into savedProgress. Where a newer version wrote any store, it writes
// nothing, not even an older store's upgrade, and returns "newer" before the session begins.
export async function loadProgress(): Promise<SaveAge> {
  const [loaded, earned] = await Promise.all([store.load(), achievements.load()]);
  const statsStatus = await stats.load(loaded.status !== "newer" && earned.status !== "newer");
  if ([loaded.status, statsStatus, earned.status].includes("newer")) {
    return "newer";
  }
  progress = loaded.save;
  if (activeSkill() === "speedy") {
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
    void inFlight(achievements.award(fresh));
  }
}

// What a live step did for the records: the characters whose pursuit it ended in an escape, and
// whether it used a skill (zoneStepRecord).
export function recordStageStepAchievements(
  stage: string,
  step: { readonly escaped: readonly string[]; readonly skillUsed: boolean },
): void {
  if (!STAGES.has(stage)) {
    return;
  }
  if (step.skillUsed || activeSkill() === "speedy") {
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
    void inFlight(achievements.announced(id));
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
export function beginStageRun(stage: string): void {
  if (STAGES.has(stage)) {
    if (progress.at === "beginning") {
      writeStand(stage);
    }
    stats.beginRun(stage);
    if (stage === ZONE_MAP.start) {
      queueTip({ id: "controls" });
    }
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

// Flushes the statistics and waits until every progress and achievement write has settled, so
// nothing is lost when the page reloads into another build: Update now's save. A failed write
// stays failed, as it would without the switch.
export async function settleWrites(): Promise<void> {
  await flushStats();
  while (writesInFlight.size > 0) {
    // Each pass waits for the writes queued so far; one queued meanwhile is caught by the next.
    // eslint-disable-next-line no-await-in-loop
    await Promise.allSettled([...writesInFlight]);
  }
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

// The selected skill while it is owned, or none.
export function activeSkill(): SkillId | null {
  return resolveActiveSkill(progress.skills, progress.activeSkill);
}

// Selects an owned skill, or with null turns the selection off. An unchanged or unowned selection
// is rejected.
export function selectActiveSkill(skill: SkillId | null): boolean {
  if ((skill !== null && !progress.skills.includes(skill)) || activeSkill() === skill) {
    return false;
  }
  write({ ...progress, activeSkill: skill });
  return true;
}

// Saves ownership of skill, with its tips and achievements: a power-up pickup's grant.
export function grantSkill(skill: SkillId): boolean {
  const granted = withGrantedSkill(progress, skill);
  if (granted === progress) {
    return false;
  }
  const effects = skillGrantEffects(earnedIds, stats.skillUsed(), granted);
  write(granted);
  queueGrantTips(skill);
  if (effects.awarded.length > 0) {
    earnedIds = [...earnedIds, ...effects.awarded];
    notices.push(effects.awarded);
    void inFlight(achievements.award(effects.awarded));
  }
  return true;
}

// Unlock all power-ups: grants each skill not owned yet, as a pickup does.
export function grantAllSkills(): void {
  SKILL_IDS.forEach((skill) => grantSkill(skill));
}

// Unlock all zones: every zone and stage opens on the map, none of them completed.
export function unlockAllZones(): void {
  if (!progress.allZonesUnlocked) {
    write({ ...progress, allZonesUnlocked: true });
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

export function saveOpeningSeen(): void {
  write({ ...progress, openingSeen: true });
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
export function recordStageChunks(stage: string, middle: readonly string[]): void {
  const zone = ZONE_MAP.destinations.find(({ stages }) => stages.includes(stage))?.id;
  if (zone === undefined || progress.at !== "map") {
    return;
  }
  write(withRecentMiddleChunks(zone, middle, progress));
}

export function seenZoneIntros(): readonly string[] {
  return progress.at === "map" ? progress.seenZoneIntros : [];
}

export function saveZoneIntro(zone: string): void {
  const seen = seenZoneIntros();
  if (seen.includes(zone)) {
    return;
  }
  write({
    activeSkill: progress.activeSkill,
    allZonesUnlocked: progress.allZonesUnlocked,
    at: "map",
    ...savedMap(),
    openingSeen: progress.openingSeen,
    ...savedRecent(),
    seenTips: progress.seenTips,
    seenZoneIntros: [...seen, zone],
    skills: progress.skills,
  });
}

// Map browsing updates an existing game; only actual stage entry starts a new one.
export function saveStand(stand: string): void {
  void flushStats();
  if (progress.at !== "beginning") {
    writeStand(stand);
  }
}

function writeStand(stand: string): void {
  write({
    activeSkill: progress.activeSkill,
    allZonesUnlocked: progress.allZonesUnlocked,
    at: "map",
    completed: savedMap().completed,
    openingSeen: progress.openingSeen,
    ...savedRecent(),
    seenTips: progress.seenTips,
    seenZoneIntros: seenZoneIntros(),
    skills: progress.skills,
    stand,
  });
}

// A ?zone= run link's clear of stage, as a map clear records it: its run statistics and clear
// achievements, then its completion and stand where the map opens it. A stage the map does not
// open keeps the map unchanged, since the save format refuses a completed stage it cannot reach.
// Anything but a catalogued stage records nothing.
export function completeRunLinkStage(stage: string): void {
  if (!STAGES.has(stage)) {
    return;
  }
  completeStageRun(stage);
  const { completed } = savedMap();
  if (openMap(ZONE_MAP, new Set(completed), progress.allZonesUnlocked).zones.includes(stage)) {
    saveCompleted(stage);
  }
}

// He has completed the zone at node: it opens the map past it, and he stands on it.
export function saveCompleted(node: string): void {
  const { completed } = savedMap();
  write({
    activeSkill: progress.activeSkill,
    allZonesUnlocked: progress.allZonesUnlocked,
    at: "map",
    completed: completed.includes(node) ? completed : [...completed, node],
    openingSeen: progress.openingSeen,
    ...savedRecent(),
    seenTips: progress.seenTips,
    seenZoneIntros: seenZoneIntros(),
    skills: progress.skills,
    stand: node,
  });
}

function write(next: Progress): void {
  progress = next;
  if (activeSkill() === "speedy") {
    stats.useSkill();
  }
  void persist(next);
}

function persist(next: Progress): Promise<StoreSaveResult> {
  return inFlight(store.save(next));
}

// Reset save: progress, statistics and achievements go back to a new game's, each written, and
// nothing is queued. Settings outside the save stay. The first failed write's result, otherwise
// saved.
export async function resetSave(): Promise<StoreSaveResult> {
  const { age, canReset } = await probeStoredGame(storage);
  if (age !== "current") {
    return {
      reason: age === "newer" ? "a newer version wrote the save" : "the save could not be read",
      status: "unavailable",
    };
  }
  if (!canReset) {
    return { reason: "there is no stored game to reset", status: "invalid" };
  }
  tips = [];
  progress = BEGINNING;
  earnedIds = [];
  notices = new CelebrationQueue<AchievementId>();
  const earned = saveStore(localSaveStorage(), ACHIEVEMENT_KEYS, ACHIEVEMENTS_FORMAT);
  const [saved, awarded, statistics] = await Promise.all([
    persist(BEGINNING),
    inFlight(earned.save({ earned: [], unannounced: [] })),
    stats.reset(),
  ]);
  achievements = achievementsStore(localSaveStorage());
  await achievements.load();
  return [saved, awarded, statistics].find((result) => result.status !== "saved") ?? saved;
}

// Restart: progress goes back to the beginning, with no tip seen, and the map opens on the first
// zone with nothing completed. Only progress is cleared.
export function clearProgress(): void {
  void flushStats();
  tips = [];
  write(BEGINNING);
}

// Queues tip behind the triggered ones unless it has shown this playthrough or is queued, the
// power-up tip once for each skill (seenTip).
function queueTip(tip: QueuedTip): void {
  const seen = seenTip(tip);
  if (!progress.seenTips.includes(seen) && !tips.some((queued) => seenTip(queued) === seen)) {
    tips.push(tip);
  }
}

// A new grant of skill triggers its power-up tip, naming skill, and once two skills are owned the
// switch tip.
function queueGrantTips(skill: SkillId): void {
  queueTip({ id: "powerUp", skill });
  if (progress.skills.length >= 2) {
    queueTip({ id: "secondPowerUp" });
  }
}

// What play shows triggers these tips (a door or red hazard in view, a boss acquiring him).
export function triggerTips(ids: readonly PlayTipId[]): void {
  ids.forEach((id) => queueTip({ id }));
}

// The next triggered tip to show unless blocked, once every queued unlock notice has shown,
// saved as seen as it starts.
export function nextTip(blocked: () => boolean): QueuedTip | undefined {
  if (tips.length === 0 || notices.pending().length > 0 || blocked()) {
    return undefined;
  }
  const tip = tips.shift()!;
  write({ ...progress, seenTips: [...progress.seenTips, seenTip(tip)] });
  return tip;
}
