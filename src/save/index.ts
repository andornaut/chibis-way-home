import { saveStore } from "@andornaut/game-kit/save/saveStore";
import { localSaveStorage } from "@andornaut/game-kit/save/storage";

import { ZONE_MAP } from "../data/map";
import { RECIPES, ZONES } from "../data/zones";
import { activeStepSeconds } from "../rules/death";
import type { ZoneState } from "../rules/zone";
import { BEGINNING, mapProgress, type Progress, progressFormat } from "./progress";
import { stageStatsStore } from "./stats";

export { type Progress } from "./progress";

const KEYS = { backup: "chibis-way-home.save-backup", save: "chibis-way-home.save" } as const;

const store = saveStore(
  localSaveStorage(),
  KEYS,
  progressFormat(ZONE_MAP, { ...ZONES, ...RECIPES }),
);
let progress: Progress = BEGINNING;
const STAGES = new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages));
const stats = stageStatsStore(localSaveStorage(), STAGES);
let statsLifecycleInstalled = false;

function installStatsLifecycle(): void {
  if (statsLifecycleInstalled || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  statsLifecycleInstalled = true;
  window.addEventListener("pagehide", () => {
    void stats.flush();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void stats.flush();
    }
  });
}

// Reads the stored progress into savedProgress.
export async function loadProgress(): Promise<void> {
  const [loaded] = await Promise.all([store.load(), stats.load()]);
  progress = loaded.save;
  installStatsLifecycle();
}

export function activeStageTime(stage: string): number {
  return stats.seconds(stage);
}

// Developer test chains have no persistent stage identity and do not write real-stage stats.
export function recordActiveStageStep(
  stage: string,
  seconds: number,
  before: ZoneState,
  after: ZoneState,
): void {
  if (STAGES.has(stage)) {
    stats.addActiveTime(stage, activeStepSeconds(seconds, before, after));
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

// The saved progress, or the beginning.
export function savedProgress(): Progress {
  return progress;
}

// Where he is on the map: the zones he has completed and the zone node he stands on, the
// map's start with nothing completed from the beginning.
export function savedMap(): { readonly completed: readonly string[]; readonly stand: string } {
  return mapProgress(ZONE_MAP, progress);
}

export function seenZoneIntros(): readonly string[] {
  return progress.at === "map" ? progress.seenZoneIntros : [];
}

export function saveZoneIntro(zone: string): void {
  const seen = seenZoneIntros();
  if (seen.includes(zone)) {
    return;
  }
  write({ at: "map", ...savedMap(), seenZoneIntros: [...seen, zone] });
}

// He stands on the zone node stand: the map opens there.
export function saveStand(stand: string): void {
  void stats.flush();
  write({ at: "map", completed: savedMap().completed, seenZoneIntros: seenZoneIntros(), stand });
}

// He has completed the zone at node: it opens the map past it, and he stands on it.
export function saveCompleted(node: string): void {
  clearStageTime(node);
  const { completed } = savedMap();
  write({
    at: "map",
    completed: completed.includes(node) ? completed : [...completed, node],
    seenZoneIntros: seenZoneIntros(),
    stand: node,
  });
}

function write(next: Progress): void {
  progress = next;
  void store.save(next);
}

// Restart: progress goes back to the beginning, and the map opens on the first zone with nothing
// completed. Only progress is cleared.
export function clearProgress(): void {
  void stats.flush();
  write(BEGINNING);
}
