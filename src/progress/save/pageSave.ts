import { saveStore } from "@andornaut/game-kit/save/saveStore";
import { loadSave } from "@andornaut/game-kit/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/web/save/dom/localSaveStorage";

import { ZONE_MAP } from "../../data/map";
import type { SkillId } from "../../data/types";
import { RECIPES, ZONES } from "../../data/zones";
import { eligibleSkills, resolveActiveSkill, type SkillOverrides } from "../skills";
import { BEGINNING, mapProgress, type Progress, progressFormat } from "./progress";
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
const format = progressFormat(ZONE_MAP, { ...ZONES, ...RECIPES });
const store = saveStore(storage, KEYS, format);
let progress: Progress = BEGINNING;
let developmentOwned: readonly SkillId[] | undefined;
let developmentSavedSelection: SkillId | null | undefined;
let temporarySelection: SkillId | null | undefined;
const STAGES = new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages));
const stats = stageStatsStore(localSaveStorage(), STAGES, ZONE_MAP.destinations);
let statsLifecycleInstalled = false;

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
  const [loaded] = await Promise.all([store.load(), stats.load()]);
  progress = loaded.save;
  installStatsLifecycle(session);
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
  return stats.completeStage(stage);
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
