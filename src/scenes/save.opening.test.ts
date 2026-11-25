import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";
import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import { createPageSave } from "../progress/save/pageSave.ts";
import { createSave } from "./save.ts";

// A page save of its own over the stubbed localStorage.
const openSave = () => createSave(createPageSave(localSaveStorage(), () => false));

afterEach(() => {
  vi.unstubAllGlobals();
});

it("preserves opening acknowledgement through progress writes and resets it independently of stats", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const save = openSave();
  await save.loadProgress();
  save.saveStand(ZONE_MAP.start);
  expect(save.savedProgress()).toEqual({
    activeSkill: null,
    allZonesUnlocked: false,
    at: "beginning",
    openingSeen: false,
    seenTips: [],
    skills: [],
  });
  save.saveOpeningSeen();
  await save.loadProgress();
  expect(save.savedProgress()).toEqual({
    activeSkill: null,
    allZonesUnlocked: false,
    at: "beginning",
    openingSeen: true,
    seenTips: [],
    skills: [],
  });
  const destination = ZONE_MAP.destinations[0]!;
  const stage = destination.stages[0]!;
  save.beginStageRun(stage);
  save.retryStageRun(stage);
  save.saveZoneIntro(destination.id);
  save.saveCompleted(stage);
  save.saveStand(stage);
  await save.flushStats();
  await save.loadProgress();
  expect(save.savedProgress()).toMatchObject({ at: "map", openingSeen: true, skills: [] });
  const stats = save.stageRunStats(stage);
  save.clearProgress();
  await save.loadProgress();
  expect(save.savedProgress()).toEqual({
    activeSkill: null,
    allZonesUnlocked: false,
    at: "beginning",
    openingSeen: false,
    seenTips: [],
    skills: [],
  });
  expect(save.stageRunStats(stage)).toEqual(stats);
});
