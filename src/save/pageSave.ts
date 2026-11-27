import { CelebrationQueue } from "@andornaut/game-kit/runtime/achievements";
import {
  type SaveStore,
  saveStore,
  type StoreSaveResult,
} from "@andornaut/game-kit/runtime/save/saveStore";
import type { SaveStorage } from "@andornaut/game-kit/runtime/save/storage";
import { loadSave, type SaveFormat } from "@andornaut/game-kit/runtime/save/versionedSave";

import { BOSS_CHARACTERS } from "../data/achievements.ts";
import { CHUNKS } from "../data/chunks.ts";
import { ZONE_MAP } from "../data/map.ts";
import { ROOMS } from "../data/rooms.ts";
import type { AchievementId, BossId, SkillId } from "../data/types/index.ts";
import { RECIPES } from "../data/zones.ts";
import {
  ACHIEVEMENT_IDS,
  ACHIEVEMENT_KEYS,
  achievementEntries,
  type AchievementEntry,
  type AchievementFacts,
  ACHIEVEMENTS_FORMAT,
  type AchievementScope,
  achievementsStore,
  BEGINNING,
  earnedAt,
  hasRecordedStats,
  mapProgress,
  mapProgressBase,
  openMap,
  type PlayTipId,
  type Progress,
  PROGRESS_KEYS,
  progressFormat,
  type QueuedTip,
  type RecentChunks,
  recentMiddleChunks,
  resolveActiveSkill,
  type RunStatsSummary,
  seenTip,
  SKILL_IDS,
  stageDestinationId,
  stageStatsStore,
  STATS_KEYS,
  statsFormat,
  type WholeRunStatsSummary,
  withRecentMiddleChunks,
  zoneEndingAt,
  type ZoneStatsSummary,
} from "../progress/index.ts";
import { createGiftVisitSave } from "./giftVisit.ts";
import { skillGrantEffects, withGrantedSkill } from "./skillGrant.ts";

// What one createPageSave holds: the stores over its storage, the loaded progress and what the
// page has queued. Every operation below reads and writes it and nothing else.
type PageState = {
  achievements: ReturnType<typeof achievementsStore>;
  readonly bossesByCharacter: ReadonlyMap<string, BossId>;
  // The earned ids, including awards whose write is still queued, so a later call in the same
  // frame does not award or announce them again.
  earnedIds: readonly AchievementId[];
  readonly format: SaveFormat<Progress>;
  leavingWatched: boolean;
  // Unlock notices not shown yet: the stored unannounced ones, then each award.
  notices: CelebrationQueue<AchievementId>;
  progress: Progress;
  readonly stages: ReadonlySet<string>;
  readonly stats: ReturnType<typeof stageStatsStore>;
  readonly storage: SaveStorage;
  readonly store: SaveStore<Progress>;
  // The first-time tips triggered and not shown yet, in trigger order. They are not saved; a tip is
  // saved as seen once it starts.
  tips: QueuedTip[];
  readonly watchLeaving: (flush: () => void) => boolean;
  // The progress and achievement writes not yet settled, which settleWrites waits for.
  readonly writesInFlight: Set<Promise<unknown>>;
};

function inFlight<T>(page: PageState, write: Promise<T>): Promise<T> {
  const tracked = write.finally(() => page.writesInFlight.delete(tracked));
  page.writesInFlight.add(tracked);
  return tracked;
}

// Whether the saves on the device are this version's or older ("current"), or any was written by
// a newer version ("newer").
export type SaveAge = "current" | "newer";

// These reads do not call SaveStore.load, so even a corrupt record leaves its backup alone.
async function readStoredSave<S>(
  source: Pick<SaveStorage, "read">,
  saved: SaveFormat<S>,
  key: string,
) {
  try {
    return loadSave(saved, await source.read(key));
  } catch {
    return { status: "unavailable" } as const;
  }
}

async function probeStoredGame(
  page: PageState,
  source: Pick<SaveStorage, "read">,
): Promise<{ readonly age: SaveAge | "unavailable"; readonly canReset: boolean }> {
  const [player, earned, statistics] = await Promise.all([
    readStoredSave(source, page.format, PROGRESS_KEYS.save),
    readStoredSave(source, ACHIEVEMENTS_FORMAT, ACHIEVEMENT_KEYS.save),
    readStoredSave(source, statsFormat(page.stages, ZONE_MAP.destinations), STATS_KEYS.save),
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

async function probeSaveAge(
  page: PageState,
  source: Pick<SaveStorage, "read"> = page.storage,
): Promise<SaveAge | "unavailable"> {
  return (await probeStoredGame(page, source)).age;
}

async function resetSaveAvailable(
  page: PageState,
  source: Pick<SaveStorage, "read"> = page.storage,
): Promise<boolean> {
  return (await probeStoredGame(page, source)).canReset;
}

// Reads the stored progress into savedProgress. Where a newer version wrote any store, it writes
// nothing, not even an older store's upgrade, and returns "newer" before the session begins.
async function loadProgress(page: PageState): Promise<SaveAge> {
  const [loaded, earned] = await Promise.all([page.store.load(), page.achievements.load()]);
  const statsStatus = await page.stats.load(loaded.status !== "newer" && earned.status !== "newer");
  if ([loaded.status, statsStatus, earned.status].includes("newer")) {
    return "newer";
  }
  openLoaded(page, loaded.save, earned.save);
  return "current";
}

// Takes up what a load read: the progress, the earned achievements and their unshown notices.
function openLoaded(
  page: PageState,
  progress: Progress,
  earned: {
    readonly earned: readonly AchievementId[];
    readonly unannounced: readonly AchievementId[];
  },
): void {
  page.progress = progress;
  if (activeSkill(page) === "speedy") {
    page.stats.useSkill();
  }
  page.earnedIds = earned.earned;
  page.notices.push(earned.unannounced);
  page.leavingWatched ||= page.watchLeaving(() => {
    void flushStats(page);
  });
}

// Judges each scope with its facts beside the shared profile, and stores and queues what they
// earn, in card order.
function judgeAchievements(
  page: PageState,
  scopes: readonly (readonly [AchievementScope, Partial<AchievementFacts>])[],
): void {
  const profile = { skillUsed: page.stats.skillUsed(), skills: page.progress.journeyGiftSkills };
  const found = new Set(
    scopes.flatMap(([scope, facts]) => earnedAt(page.earnedIds, scope, { ...profile, ...facts })),
  );
  const fresh = ACHIEVEMENT_IDS.filter((id) => found.has(id));
  if (fresh.length > 0) {
    page.earnedIds = [...page.earnedIds, ...fresh];
    page.notices.push(fresh);
    void inFlight(page, page.achievements.award(fresh));
  }
}

// What a live step did for the records: the characters whose pursuit it ended in an escape, and
// whether it used a skill (zoneStepRecord).
function recordStageStepAchievements(
  page: PageState,
  stage: string,
  step: { readonly escaped: readonly string[]; readonly skillUsed: boolean },
): void {
  if (!page.stages.has(stage)) {
    return;
  }
  if (step.skillUsed || activeSkill(page) === "speedy") {
    page.stats.useSkill();
  }
  const bosses = [
    ...new Set(step.escaped.flatMap((character) => page.bossesByCharacter.get(character) ?? [])),
  ];
  judgeAchievements(
    page,
    bosses.map((boss) => ["escape", { escaped: boss }] as const),
  );
}

// The next unlock notice to show unless blocked, marked announced as it starts.
function nextAchievementNotice(page: PageState, blocked: () => boolean): AchievementId | undefined {
  const id = page.notices.takeWhen(blocked);
  if (id !== undefined) {
    void inFlight(page, page.achievements.announced(id));
  }
  return id;
}

// Every achievement for the card, in card order, with each locked entry's progress.
function achievementCard(page: PageState): AchievementEntry[] {
  const visit = page.stats.currentVisit();
  return achievementEntries(page.earnedIds, {
    skillUsed: page.stats.skillUsed(),
    skills: page.progress.journeyGiftSkills,
    ...(visit && { visit }),
  });
}

// Whether the map opens stage, the rule the save format holds a completed stage and the stand to.
function opensOnMap(page: PageState, stage: string): boolean {
  const { completed } = savedMap(page);
  return openMap(ZONE_MAP, new Set(completed), page.progress.allZonesUnlocked).zones.includes(
    stage,
  );
}

// A fresh save stands him on stage where the map opens it.
function beginStageRun(page: PageState, stage: string): void {
  if (page.stages.has(stage)) {
    if (page.progress.at === "beginning" && opensOnMap(page, stage)) {
      writeStand(page, stage);
    }
    page.stats.beginRun(stage);
    if (stage === ZONE_MAP.start) {
      queueTip(page, { id: "controls" });
    }
  }
}
function retryStageRun(page: PageState, stage: string): void {
  if (page.stages.has(stage)) {
    page.stats.retryStage(stage);
  }
}
function completeStageRun(page: PageState, stage: string): RunStatsSummary {
  const summary = page.stats.completeStage(stage);
  const zone = zoneEndingAt(ZONE_MAP, stage);
  const visit = page.stats.currentVisit();
  judgeAchievements(page, [
    ["stage-clear", { stage: { attempts: summary.attempts, id: stage } }],
    ...(zone === undefined ? [] : [["zone-clear", { zone, ...(visit && { visit }) }] as const]),
  ]);
  return summary;
}
function stageRunStats(page: PageState, stage: string): RunStatsSummary {
  return page.stats.summary(stage);
}
function zoneVisitStats(page: PageState, zone: string): ZoneStatsSummary {
  return page.stats.visitSummary(zone);
}

function activeStageTime(page: PageState, stage: string): number {
  return page.stats.seconds(stage);
}

// A step's active seconds, and whether he died on it. Only catalogued stages have records.
function recordActiveStageStep(
  page: PageState,
  stage: string,
  active: () => number,
  died: boolean,
): void {
  if (page.stages.has(stage)) {
    const seconds = active();
    page.stats.addActiveTime(stage, seconds);
    if (seconds > 0 && died) {
      page.stats.recordDeath(stage);
    }
  }
}

function clearStageTime(page: PageState, stage: string): void {
  if (page.stages.has(stage)) {
    page.stats.clearStage(stage);
  }
}

function flushStats(page: PageState): Promise<void> {
  return page.stats.flush();
}

// Flushes the statistics and waits until every progress and achievement write has settled, so
// nothing is lost when the page reloads into another build: Update now's save. A failed write
// stays failed, as it would without the switch.
async function settleWrites(page: PageState): Promise<void> {
  await flushStats(page);
  while (page.writesInFlight.size > 0) {
    // Each pass waits for the writes queued so far; one queued meanwhile is caught by the next.
    // eslint-disable-next-line no-await-in-loop
    await Promise.allSettled([...page.writesInFlight]);
  }
}

function wholeRunStats(page: PageState): WholeRunStatsSummary {
  return page.stats.wholeRun();
}

function resetWholeRunStats(page: PageState): void {
  page.stats.resetWholeRun();
  void page.stats.flush();
}

// The selected skill while it is owned, or none.
function activeSkill(page: PageState): SkillId | null {
  return resolveActiveSkill(page.progress.skills, page.progress.activeSkill);
}

// Selects an owned skill, or with null turns the selection off. An unchanged or unowned selection
// is rejected.
function selectActiveSkill(page: PageState, skill: SkillId | null): boolean {
  if ((skill !== null && !page.progress.skills.includes(skill)) || activeSkill(page) === skill) {
    return false;
  }
  write(page, { ...page.progress, activeSkill: skill });
  return true;
}

// Saves ownership of skill, with its tips and achievements: a power-up pickup's grant.
function grantSkill(page: PageState, skill: SkillId): boolean {
  const granted = withGrantedSkill(page.progress, skill);
  if (granted === page.progress) {
    return false;
  }
  const effects = skillGrantEffects(page.earnedIds, page.stats.skillUsed(), granted);
  write(page, granted);
  queueGrantTips(page, skill);
  if (effects.awarded.length > 0) {
    page.earnedIds = [...page.earnedIds, ...effects.awarded];
    page.notices.push(effects.awarded);
    void inFlight(page, page.achievements.award(effects.awarded));
  }
  return true;
}

// Unlock all power-ups: grants each skill not owned yet, as a pickup does.
function grantAllSkills(page: PageState): void {
  SKILL_IDS.forEach((skill) => grantSkill(page, skill));
}

// Unlock all zones: every zone and stage opens on the map, none of them completed.
function unlockAllZones(page: PageState): void {
  if (!page.progress.allZonesUnlocked) {
    write(page, { ...page.progress, allZonesUnlocked: true });
  }
}

// The saved progress, or the beginning.
function savedProgress(page: PageState): Progress {
  return page.progress;
}

// Where he is on the map: the zones he has completed and the zone node he stands on, the
// map's start with nothing completed from the beginning.
function savedMap(page: PageState): {
  readonly completed: readonly string[];
  readonly stand: string;
} {
  return mapProgress(ZONE_MAP, page.progress);
}

function saveOpeningSeen(page: PageState): void {
  write(page, { ...page.progress, openingSeen: true });
}

// The saved recent middle chunks, as a field to keep in the next map progress.
function savedRecent(page: PageState): { readonly recent?: RecentChunks } {
  return page.progress.at === "map" && page.progress.recent !== undefined
    ? { recent: page.progress.recent }
    : {};
}

// The middle chunk ids of the zone's latest stage entries (recentMiddleChunks).
function savedRecentMiddleChunks(page: PageState, zone: string): readonly (readonly string[])[] {
  return recentMiddleChunks(page.progress, zone);
}

// The middle chunk ids a fresh entry of a catalogued stage avoids: its destination's recent
// entries, newest first.
function recentStageChunks(page: PageState, stage: string): readonly (readonly string[])[] {
  const zone = stageDestinationId(ZONE_MAP, stage);
  return zone === undefined ? [] : recentMiddleChunks(page.progress, zone);
}

// A fresh entry of a catalogued stage, after assembly, with its plan's middle chunk ids: the
// stage's destination remembers them as its newest entry.
function recordStageChunks(page: PageState, stage: string, middle: readonly string[]): void {
  const zone = stageDestinationId(ZONE_MAP, stage);
  if (zone === undefined || page.progress.at !== "map") {
    return;
  }
  write(page, withRecentMiddleChunks(zone, middle, page.progress));
}

function seenZoneIntros(page: PageState): readonly string[] {
  return page.progress.at === "map" ? page.progress.seenZoneIntros : [];
}

function saveZoneIntro(page: PageState, zone: string): void {
  const seen = seenZoneIntros(page);
  if (seen.includes(zone)) {
    return;
  }
  write(page, {
    ...mapProgressBase(page.progress),
    ...savedMap(page),
    ...savedRecent(page),
    seenZoneIntros: [...seen, zone],
  });
}

// Map browsing updates an existing game; only actual stage entry starts a new one.
function saveStand(page: PageState, stand: string): void {
  void flushStats(page);
  if (page.progress.at !== "beginning") {
    writeStand(page, stand);
  }
}

function writeStand(page: PageState, stand: string): void {
  write(page, {
    ...mapProgressBase(page.progress),
    completed: savedMap(page).completed,
    ...savedRecent(page),
    seenZoneIntros: seenZoneIntros(page),
    stand,
  });
}

// A ?zone= run link's clear of stage, as a map clear records it: its run statistics and clear
// achievements, then its completion and stand where the map opens it. A stage the map does not
// open keeps the map unchanged, since the save format refuses a completed stage it cannot reach.
// Anything but a catalogued stage records nothing.
function completeRunLinkStage(page: PageState, stage: string): void {
  if (!page.stages.has(stage)) {
    return;
  }
  completeStageRun(page, stage);
  if (opensOnMap(page, stage)) {
    saveCompleted(page, stage);
  }
}

// He has completed the zone at node: it opens the map past it, and he stands on it.
function saveCompleted(page: PageState, node: string): void {
  const { completed } = savedMap(page);
  write(page, {
    ...mapProgressBase(page.progress),
    completed: completed.includes(node) ? completed : [...completed, node],
    ...savedRecent(page),
    seenZoneIntros: seenZoneIntros(page),
    stand: node,
  });
}

function write(page: PageState, next: Progress): void {
  page.progress = next;
  if (activeSkill(page) === "speedy") {
    page.stats.useSkill();
  }
  void persist(page, next);
}

function persist(page: PageState, next: Progress): Promise<StoreSaveResult> {
  return inFlight(page, page.store.save(next));
}

// Reset save: progress, statistics and achievements go back to a new game's, each written, and
// nothing is queued. Settings outside the save stay. The first failed write's result, otherwise
// saved.
async function resetSave(page: PageState): Promise<StoreSaveResult> {
  const { age, canReset } = await probeStoredGame(page, page.storage);
  if (age !== "current") {
    return {
      reason: age === "newer" ? "a newer version wrote the save" : "the save could not be read",
      status: "unavailable",
    };
  }
  if (!canReset) {
    return { reason: "there is no stored game to reset", status: "invalid" };
  }
  const [saved, awarded, statistics] = await Promise.all(writeNewGame(page));
  await reopenAchievements(page).load();
  return [saved, awarded, statistics].find((result) => result.status !== "saved") ?? saved;
}

// Empties what the page holds and starts the three writes of a new game.
function writeNewGame(page: PageState) {
  page.tips = [];
  page.progress = BEGINNING;
  page.earnedIds = [];
  page.notices = new CelebrationQueue<AchievementId>();
  const earned = saveStore(page.storage, ACHIEVEMENT_KEYS, ACHIEVEMENTS_FORMAT);
  return [
    persist(page, BEGINNING),
    inFlight(page, earned.save({ earned: [], unannounced: [] })),
    page.stats.reset(),
  ] as const;
}

function reopenAchievements(page: PageState): ReturnType<typeof achievementsStore> {
  page.achievements = achievementsStore(page.storage);
  return page.achievements;
}

// Restart: progress goes back to the beginning, with no tip seen, and the map opens on the first
// zone with nothing completed. Only progress is cleared.
function clearProgress(page: PageState): void {
  void flushStats(page);
  page.tips = [];
  write(page, BEGINNING);
}

// Queues tip behind the triggered ones unless it has shown this playthrough or is queued, the
// power-up tip once for each skill (seenTip).
function queueTip(page: PageState, tip: QueuedTip): void {
  const seen = seenTip(tip);
  if (
    !page.progress.seenTips.includes(seen) &&
    !page.tips.some((queued) => seenTip(queued) === seen)
  ) {
    page.tips.push(tip);
  }
}

// A new grant of skill triggers its power-up tip, naming skill, and once two skills are owned the
// switch tip.
function queueGrantTips(page: PageState, skill: SkillId): void {
  queueTip(page, { id: "powerUp", skill });
  if (page.progress.skills.length >= 2) {
    queueTip(page, { id: "secondPowerUp" });
  }
}

// What play shows triggers these tips (a door or red hazard in view, a boss acquiring him).
function triggerTips(page: PageState, ids: readonly PlayTipId[]): void {
  ids.forEach((id) => queueTip(page, { id }));
}

// The next triggered tip to show unless blocked, once every queued unlock notice has shown,
// saved as seen as it starts.
function nextTip(page: PageState, blocked: () => boolean): QueuedTip | undefined {
  if (page.tips.length === 0 || page.notices.pending().length > 0 || blocked()) {
    return undefined;
  }
  const tip = page.tips.shift()!;
  write(page, { ...page.progress, seenTips: [...page.progress.seenTips, seenTip(tip)] });
  return tip;
}

// An operation with its page state already given.
function bound<Rest extends unknown[], Result>(
  page: PageState,
  operation: (page: PageState, ...rest: Rest) => Result,
): (...rest: Rest) => Result {
  return (...rest) => operation(page, ...rest);
}

/** The page's saves: every operation of one createPageSave. */
export type PageSave = ReturnType<typeof createPageSave>;

/**
 * The page's saves over storage: progress, statistics, earned achievements, and the unlock notices
 * and first-time tips not shown yet. Nothing is read until loadProgress. Each load that finds no
 * newer save hands watchLeaving the flush to run whenever the page is hidden or left, until it
 * returns true.
 */
export function createPageSave(storage: SaveStorage, watchLeaving: (flush: () => void) => boolean) {
  const format = progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS)));
  const stages = new Set(ZONE_MAP.destinations.flatMap(({ stages: ids }) => ids));
  const page: PageState = {
    achievements: achievementsStore(storage),
    bossesByCharacter: new Map(
      Object.entries(BOSS_CHARACTERS).map(([boss, character]) => [character, boss as BossId]),
    ),
    earnedIds: [],
    format,
    leavingWatched: false,
    notices: new CelebrationQueue<AchievementId>(),
    progress: BEGINNING,
    stages,
    stats: stageStatsStore(storage, stages, ZONE_MAP.destinations),
    storage,
    store: saveStore(storage, PROGRESS_KEYS, format),
    tips: [],
    watchLeaving,
    writesInFlight: new Set(),
  };
  return {
    ...createGiftVisitSave(ZONE_MAP, ROOMS, {
      progress: () => page.progress,
      write: (next) => write(page, next),
    }),
    achievementCard: bound(page, achievementCard),
    activeSkill: bound(page, activeSkill),
    activeStageTime: bound(page, activeStageTime),
    beginStageRun: bound(page, beginStageRun),
    beginZoneVisit: (zone: string) => page.stats.beginVisit(zone),
    clearProgress: bound(page, clearProgress),
    clearStageTime: bound(page, clearStageTime),
    completeRunLinkStage: bound(page, completeRunLinkStage),
    completeStageRun: bound(page, completeStageRun),
    flushStats: bound(page, flushStats),
    grantAllSkills: bound(page, grantAllSkills),
    grantSkill: bound(page, grantSkill),
    loadProgress: bound(page, loadProgress),
    nextAchievementNotice: bound(page, nextAchievementNotice),
    nextTip: bound(page, nextTip),
    probeSaveAge: bound(page, probeSaveAge),
    recentStageChunks: bound(page, recentStageChunks),
    recordActiveStageStep: bound(page, recordActiveStageStep),
    recordStageChunks: bound(page, recordStageChunks),
    recordStageStepAchievements: bound(page, recordStageStepAchievements),
    resetSave: bound(page, resetSave),
    resetSaveAvailable: bound(page, resetSaveAvailable),
    resetWholeRunStats: bound(page, resetWholeRunStats),
    retryStageRun: bound(page, retryStageRun),
    saveCompleted: bound(page, saveCompleted),
    saveOpeningSeen: bound(page, saveOpeningSeen),
    saveStand: bound(page, saveStand),
    saveZoneIntro: bound(page, saveZoneIntro),
    savedMap: bound(page, savedMap),
    savedProgress: bound(page, savedProgress),
    savedRecentMiddleChunks: bound(page, savedRecentMiddleChunks),
    savedSkills: () => page.progress.skills,
    seenZoneIntros: bound(page, seenZoneIntros),
    selectActiveSkill: bound(page, selectActiveSkill),
    settleWrites: bound(page, settleWrites),
    stageRunStats: bound(page, stageRunStats),
    triggerTips: bound(page, triggerTips),
    unlockAllZones: bound(page, unlockAllZones),
    wholeRunStats: bound(page, wholeRunStats),
    zoneVisitStats: bound(page, zoneVisitStats),
  };
}
