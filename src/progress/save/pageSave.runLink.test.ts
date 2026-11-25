import { encodeSave } from "@andornaut/game-kit/runtime/save/versionedSave";
import { afterEach, expect, it, vi } from "vitest";

import { ACHIEVEMENTS } from "../../data/achievements.ts";
import { CHUNKS } from "../../data/chunks.ts";
import { ZONE_MAP } from "../../data/map.ts";
import type { AchievementCondition } from "../../data/types/index.ts";
import { RECIPES } from "../../data/zones.ts";
import { BEGINNING, PROGRESS_KEYS, progressFormat } from "./progress.ts";

const ACHIEVEMENTS_KEY = "chibis-way-home.achievements";
const FIRST = ZONE_MAP.destinations[0]!;
const LAST = FIRST.stages.at(-1)!;
const STAGES = ZONE_MAP.destinations.flatMap(({ stages }) => stages);
const UNCATALOGUED = Object.keys(RECIPES).filter((key) => !STAGES.includes(key));

// What a first-try clear of the zone's last stage earns in a one-stage visit.
const holds = (condition: AchievementCondition): boolean =>
  (condition.kind === "stage-first-try" && condition.stage === LAST) ||
  (condition.kind === "zone-cleared" && condition.zone === FIRST.id);
const CLEAR_ACHIEVEMENTS = ACHIEVEMENTS.filter(({ conditions }) => conditions.every(holds))
  .map(({ id }) => id)
  .toSorted();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// localStorage holding a map save with completed done, standing on the last of them or the start,
// or no save without done.
function storage(done?: readonly string[]): Map<string, string> {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  if (done === undefined) {
    return values;
  }
  const raw = encodeSave(progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS))), {
    ...BEGINNING,
    at: "map",
    completed: done,
    seenZoneIntros: [],
    stand: done.at(-1) ?? ZONE_MAP.start,
  });
  if (!raw.ok) {
    throw new Error(raw.reason);
  }
  values.set(PROGRESS_KEYS.save, raw.value);
  return values;
}

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

const earned = (values: Map<string, string>) =>
  (JSON.parse(values.get(ACHIEVEMENTS_KEY) ?? '{"earned":[]}') as { earned: string[] }).earned;

it.each([
  { done: FIRST.stages.slice(0, -1), open: true },
  { done: [], open: false },
])(
  "a run link's clear earns its clear achievements and completes it where open ($open)",
  async ({ done, open }) => {
    expect(CLEAR_ACHIEVEMENTS).not.toHaveLength(0);
    const values = storage(done);
    const save = await import("./pageSave.ts");
    await save.loadProgress();
    save.beginZoneVisit(FIRST.id);
    save.beginStageRun(LAST);
    save.completeRunLinkStage(LAST);
    await settle();
    const map = open
      ? { completed: [...done, LAST], stand: LAST }
      : { completed: done, stand: ZONE_MAP.start };
    const stored = JSON.parse(values.get(PROGRESS_KEYS.save)!) as Record<string, unknown>;
    expect({
      earned: earned(values).toSorted(),
      map: save.savedMap(),
      stored: { completed: stored.completed, stand: stored.stand },
    }).toEqual({ earned: CLEAR_ACHIEVEMENTS, map, stored: map });
  },
);

it("a run link's clear of a recipe with no catalogued stage records nothing", async () => {
  expect(UNCATALOGUED).not.toHaveLength(0);
  const values = storage([]);
  const save = await import("./pageSave.ts");
  await save.loadProgress();
  await settle();
  const before = new Map(values);
  for (const key of UNCATALOGUED) {
    save.beginStageRun(key);
    save.completeRunLinkStage(key);
  }
  await save.flushStats();
  await settle();
  expect(values).toEqual(before);
  expect(save.savedMap()).toEqual({ completed: [], stand: ZONE_MAP.start });
});

it("a fresh save's run link of a closed stage leaves its stand, so later writes save", async () => {
  const values = storage();
  const save = await import("./pageSave.ts");
  await save.loadProgress();
  save.beginStageRun(LAST);
  save.saveOpeningSeen();
  await settle();
  const stored = JSON.parse(values.get(PROGRESS_KEYS.save) ?? "{}") as Record<string, unknown>;
  expect(save.savedMap()).toEqual({ completed: [], stand: ZONE_MAP.start });
  expect({ at: stored.at, openingSeen: stored.openingSeen }).toEqual({
    at: "beginning",
    openingSeen: true,
  });
});
