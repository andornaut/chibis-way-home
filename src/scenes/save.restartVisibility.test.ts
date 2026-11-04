import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function storage(): void {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
}

it("keeps confirmed Restart cleared across map browsing and reopen until real stage entry", async () => {
  storage();
  const save = await import("./save");
  await save.loadProgress();
  const stage = ZONE_MAP.start;
  save.beginStageRun(stage);
  expect(save.savedProgress().at).toBe("map");
  save.retryStageRun(stage);
  const stats = save.stageRunStats(stage);
  save.clearProgress();
  save.saveStand(stage);
  save.saveStand(save.savedMap().stand);
  await save.flushStats();
  await save.loadProgress();
  expect(save.savedProgress()).toEqual({
    activeSkill: null,
    at: "beginning",
    openingSeen: false,
    skills: [],
  });
  expect(save.stageRunStats(stage)).toEqual(stats);
  expect(save.savedMap().stand).toBe(stage);
  save.beginStageRun(stage);
  await save.loadProgress();
  expect(save.savedProgress()).toMatchObject({ at: "map", completed: [], stand: stage });
  save.saveStand(stage);
  await save.loadProgress();
  expect(save.savedProgress().at).toBe("map");
});

it("does not begin saved progress for a non-catalogued diagnostic stage", async () => {
  storage();
  const save = await import("./save");
  await save.loadProgress();
  save.beginStageRun("diagnostic-fixture");
  save.saveStand(ZONE_MAP.start);
  await save.loadProgress();
  expect(save.savedProgress()).toEqual({
    activeSkill: null,
    at: "beginning",
    openingSeen: false,
    skills: [],
  });
});
