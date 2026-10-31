import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("persists a zone introduction across stage moves, clears and reopen, then resets on Restart", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const save = await import("./index");
  await save.loadProgress();
  const destination = ZONE_MAP.destinations[0]!;
  const stage = destination.stages[0];
  save.saveZoneIntro(destination.id);
  save.saveCompleted(stage);
  save.saveStand(destination.stages[1] ?? stage);
  await save.loadProgress();
  expect(save.seenZoneIntros()).toEqual([destination.id]);
  save.saveZoneIntro(destination.id);
  expect(save.seenZoneIntros()).toEqual([destination.id]);
  save.clearProgress();
  await save.loadProgress();
  expect(save.seenZoneIntros()).toEqual([]);
  expect(save.savedProgress().at).toBe("beginning");
});
