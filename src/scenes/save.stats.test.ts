import { afterEach, expect, it, vi } from "vitest";

import { BIRD_FRAME } from "../assets";
import { BIRD } from "../data/bird";
import { ZONE_MAP } from "../data/map";
import { STATS_VERSION } from "../progress";
import { zoneLayout } from "../rules/tiles";
import { startZone, stepZone } from "../rules/zone";

const LAYOUT = zoneLayout(12, BIRD_FRAME, { archetypes: {}, characters: {} }, {}, {}, new Set(), {
  areas: {
    course: {
      cols: 60,
      entries: { start: { col: 4, row: 20 } },
      objects: [],
      rows: 30,
      solids: [{ col: 0, cols: 60, row: 20, rows: 10 }],
    },
  },
  start: { area: "course", entry: "start" },
});
const INPUT = { jumpHeld: false, move: 0 as const, useHeld: false };
const INITIAL = startZone(BIRD, LAYOUT, 1);
const ACTIVE = stepZone(BIRD, LAYOUT, 0.1, INPUT, INITIAL);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("preserves run statistics across progress restart and completion", async () => {
  const values = new Map<string, string>([
    [
      "chibis-way-home.stats",
      JSON.stringify({
        stages: { park: { activeSeconds: 2 }, street: { activeSeconds: 3 } },
        version: STATS_VERSION - 1,
      }),
    ],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const save = await import("./save");
  await save.loadProgress();
  expect(values.has("chibis-way-home.stats-backup")).toBe(true);
  expect(save.activeStageTime("street")).toBe(0);
  save.beginZoneVisit(ZONE_MAP.destinations[0]!.id);
  save.beginStageRun("street");
  save.recordActiveStageStep("park", 0.1, INITIAL, ACTIVE);
  expect(save.activeStageTime("park")).toBe(0);
  save.recordActiveStageStep("street", 0.1, INITIAL, ACTIVE);
  save.clearProgress();
  await save.flushStats();
  expect(save.activeStageTime("street")).toBe(0.1);
  expect(values.has("chibis-way-home.stats")).toBe(true);
  const completed = save.completeStageRun("street");
  save.saveCompleted("street");
  await save.flushStats();
  expect(save.stageRunStats("street")).toEqual(completed);
  expect(completed).toMatchObject({
    attemptSeconds: 0.1,
    attempts: 1,
    bestSeconds: 0.1,
    runSeconds: 0.1,
  });
});
