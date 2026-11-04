import { saveStore } from "@andornaut/game-kit/save/saveStore";
import { loadSave } from "@andornaut/game-kit/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/web/save/dom/localSaveStorage";

import { ZONE_MAP } from "../data/map";
import type { SkillId } from "../data/types";
import { RECIPES, ZONES } from "../data/zones";
import { developmentSkillOverrides, isDevelopmentSession } from "../dev/mode";
import { activeStepSeconds } from "../rules/death";
import { eligibleSkills, resolveActiveSkill } from "../rules/skills";
import type { ZoneState } from "../rules/zone";
import { BEGINNING, mapProgress, type Progress, progressFormat } from "./progress";
import {
  type RunStatsSummary,
  stageStatsStore,
  type WholeRunStatsSummary,
  type ZoneStatsSummary,
} from "./stats";

export { type Progress } from "./progress";

const KEYS = { backup: "chibis-way-home.save-backup", save: "chibis-way-home.save" } as const;

const storage = localSaveStorage();
const format = progressFormat(ZONE_MAP, { ...ZONES, ...RECIPES });
const store = saveStore(storage, KEYS, format);
let progress: Progress = BEGINNING;
let developmentOwned: readonly SkillId[] | undefined;
let developmentSavedSelection: SkillId | null | undefined;
let temporarySelection: SkillId | null | undefined;
const STAGES = new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages));
const stats = stageStatsStore(localSaveStorage(), STAGES, ZONE_MAP.destinations);
let statsLifecycleInstalled = false;

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

// Reads the stored progress into savedProgress.
export async function loadProgress(): Promise<void> {
  if (isDevelopmentSession()) {
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
  const [loaded] = await Promise.all([store.load(), stats.load()]);
  progress = loaded.save;
  installStatsLifecycle();
}

export function beginZoneVisit(zone: string): void {
  if (isDevelopmentSession()) {
    return;
  }
  stats.beginVisit(zone);
}
export function beginStageRun(stage: string): void {
  if (isDevelopmentSession()) {
    return;
  }
  if (STAGES.has(stage)) {
    if (progress.at === "beginning") {
      writeStand(stage);
    }
    stats.beginRun(stage);
  }
}
export function retryStageRun(stage: string): void {
  if (isDevelopmentSession()) {
    return;
  }
  if (STAGES.has(stage)) {
    stats.retryStage(stage);
  }
}
export function completeStageRun(stage: string): RunStatsSummary {
  if (isDevelopmentSession()) {
    return stats.summary("");
  }
  return stats.completeStage(stage);
}
export function stageRunStats(stage: string): RunStatsSummary {
  return stats.summary(isDevelopmentSession() ? "" : stage);
}
export function zoneVisitStats(zone: string): ZoneStatsSummary {
  return stats.visitSummary(isDevelopmentSession() ? "" : zone);
}

export function activeStageTime(stage: string): number {
  return stats.seconds(isDevelopmentSession() ? "" : stage);
}

// Developer test chains have no persistent stage identity and do not write real-stage stats.
export function recordActiveStageStep(
  stage: string,
  seconds: number,
  before: ZoneState,
  after: ZoneState,
): void {
  if (!isDevelopmentSession() && STAGES.has(stage)) {
    const active = activeStepSeconds(seconds, before, after);
    stats.addActiveTime(stage, active);
    if (active > 0 && before.death === undefined && after.death !== undefined) {
      stats.recordDeath(stage);
    }
  }
}

export function clearStageTime(stage: string): void {
  if (isDevelopmentSession()) {
    return;
  }
  if (STAGES.has(stage)) {
    stats.clearStage(stage);
  }
}

export function flushStats(): Promise<void> {
  return isDevelopmentSession() ? Promise.resolve() : stats.flush();
}

export function wholeRunStats(): WholeRunStatsSummary {
  return isDevelopmentSession() ? { activeSeconds: 0, deaths: 0 } : stats.wholeRun();
}

export function resetWholeRunStats(): void {
  if (isDevelopmentSession()) {
    return;
  }
  stats.resetWholeRun();
  void stats.flush();
}

export function savedSkills(): readonly SkillId[] {
  return developmentOwned ?? progress.skills;
}

export function activeSkill(): SkillId | null {
  const eligible = eligibleSkills(developmentSkillOverrides(), savedSkills());
  if (!isDevelopmentSession()) {
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

export function selectActiveSkill(skill: SkillId): boolean {
  const eligible = eligibleSkills(developmentSkillOverrides(), savedSkills());
  if (!eligible.includes(skill) || activeSkill() === skill) {
    return false;
  }
  if (isDevelopmentSession()) {
    temporarySelection = skill;
  } else {
    write({ ...progress, activeSkill: skill });
  }
  return true;
}

export function grantSkill(skill: SkillId): boolean {
  if (isDevelopmentSession() || progress.skills.includes(skill)) {
    return false;
  }
  write({
    ...progress,
    activeSkill: progress.activeSkill ?? skill,
    skills: [...progress.skills, skill],
  });
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

export function saveOpeningSeen(): void {
  write({ ...progress, openingSeen: true });
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
    at: "map",
    ...savedMap(),
    openingSeen: progress.openingSeen,
    seenZoneIntros: [...seen, zone],
    skills: progress.skills,
  });
}

// Map browsing updates an existing game; only actual stage entry starts a new one.
export function saveStand(stand: string): void {
  if (isDevelopmentSession()) {
    return;
  }
  void flushStats();
  if (progress.at !== "beginning") {
    writeStand(stand);
  }
}

function writeStand(stand: string): void {
  write({
    activeSkill: progress.activeSkill,
    at: "map",
    completed: savedMap().completed,
    openingSeen: progress.openingSeen,
    seenZoneIntros: seenZoneIntros(),
    skills: progress.skills,
    stand,
  });
}

// He has completed the zone at node: it opens the map past it, and he stands on it.
export function saveCompleted(node: string): void {
  const { completed } = savedMap();
  write({
    activeSkill: progress.activeSkill,
    at: "map",
    completed: completed.includes(node) ? completed : [...completed, node],
    openingSeen: progress.openingSeen,
    seenZoneIntros: seenZoneIntros(),
    skills: progress.skills,
    stand: node,
  });
}

function write(next: Progress): void {
  if (isDevelopmentSession()) {
    return;
  }
  progress = next;
  void store.save(next);
}

// Restart: progress goes back to the beginning, and the map opens on the first zone with nothing
// completed. Only progress is cleared.
export function clearProgress(): void {
  if (isDevelopmentSession()) {
    return;
  }
  void flushStats();
  write(BEGINNING);
}
