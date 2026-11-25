import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";
import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import { SKILL_IDS } from "../progress/index.ts";
import type { ZoneState } from "../rules/zone/zone.ts";
import { createPageSave } from "../save/index.ts";
import { createSave } from "./save.ts";

// A page save of its own over the stubbed localStorage.
const openSave = () => createSave(createPageSave(localSaveStorage(), () => false));

const PROGRESS_KEY = "chibis-way-home.save";
const ACHIEVEMENTS_KEY = "chibis-way-home.achievements";
const INVINCIBILITY_KEY = "chibis-way-home.invincibility";
const REDUCED_MOTION_KEY = "chibis-way-home.reduced-motion";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function storage(entries: readonly (readonly [string, string])[] = []) {
  const values = new Map<string, string>(entries);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  });
  return values;
}

const page = async () => ({
  mode: await import("../dev/mode.ts"),
  save: openSave(),
});

const stages = ZONE_MAP.destinations.flatMap((zone) => zone.stages);

// A fresh page module stands in for returning to Start: nothing there restores or discards.
it("saves cheats chosen before play and the cheated play that follows, kept for Continue", async () => {
  const values = storage();
  const first = await page();
  await first.save.loadProgress();
  first.save.unlockAllPowerUps();
  first.save.unlockAllZones();
  first.mode.setInvulnerability(true);
  first.save.beginZoneVisit(ZONE_MAP.destinations[0]!.id);
  first.save.beginStageRun(ZONE_MAP.start);
  first.save.recordActiveStageStep(
    ZONE_MAP.start,
    2,
    { steps: 0 } as ZoneState,
    { death: {}, steps: 1 } as ZoneState,
  );
  first.save.completeStageRun(ZONE_MAP.start);
  first.save.saveCompleted(ZONE_MAP.start);
  first.save.saveStand(stages[1]!);
  await first.save.flushStats();
  const before = first.save.wholeRunStats();
  expect(before.deaths).toBe(1);
  expect(JSON.parse(values.get(PROGRESS_KEY)!)).toMatchObject({
    allZonesUnlocked: true,
    completed: [ZONE_MAP.start],
    skills: SKILL_IDS,
    stand: stages[1],
  });

  vi.resetModules();
  const reloaded = await page();
  await reloaded.save.loadProgress();
  expect({
    invulnerable: reloaded.mode.invulnerabilityEnabled(),
    map: reloaded.save.savedMap(),
    open: reloaded.save.mapFullyOpen(),
    skills: reloaded.save.savedSkills(),
    stats: reloaded.save.wholeRunStats(),
  }).toEqual({
    invulnerable: true,
    map: { completed: [ZONE_MAP.start], stand: stages[1] },
    open: true,
    skills: SKILL_IDS,
    stats: before,
  });
});

it("returns to a new save on Restart and keeps Invincibility on", async () => {
  const values = storage();
  const first = await page();
  await first.save.loadProgress();
  first.save.unlockAllPowerUps();
  first.save.unlockAllZones();
  first.mode.setInvulnerability(true);
  first.save.clearProgress();
  first.save.resetWholeRunStats();
  expect([first.save.savedSkills(), first.save.mapFullyOpen()]).toEqual([[], false]);

  vi.resetModules();
  const reloaded = await page();
  await reloaded.save.loadProgress();
  expect({
    invulnerable: reloaded.mode.invulnerabilityEnabled(),
    open: reloaded.save.mapFullyOpen(),
    progress: reloaded.save.savedProgress().at,
    skills: reloaded.save.savedSkills(),
    stored: JSON.parse(values.get(PROGRESS_KEY)!).allZonesUnlocked,
  }).toEqual({
    invulnerable: true,
    open: false,
    progress: "beginning",
    skills: [],
    stored: false,
  });
});

it("resets progress, statistics and achievements and keeps device settings", async () => {
  const values = storage([
    [INVINCIBILITY_KEY, "on"],
    [REDUCED_MOTION_KEY, "on"],
  ]);
  const first = await page();
  await first.save.loadProgress();
  first.save.beginZoneVisit(ZONE_MAP.destinations[0]!.id);
  first.save.beginStageRun(ZONE_MAP.start);
  first.save.recordActiveStageStep(
    ZONE_MAP.start,
    4,
    { steps: 0 } as ZoneState,
    { death: {}, steps: 1 } as ZoneState,
  );
  first.save.unlockAllPowerUps();
  first.save.unlockAllZones();
  first.save.saveCompleted(ZONE_MAP.start);
  await first.save.flushStats();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(JSON.parse(values.get(ACHIEVEMENTS_KEY)!).earned).not.toEqual([]);

  expect((await first.save.resetSave()).status).toBe("saved");
  vi.resetModules();
  const reloaded = await page();
  await reloaded.save.loadProgress();
  expect({
    earned: reloaded.save.achievementCard().filter(({ earned }) => earned),
    invulnerable: reloaded.mode.invulnerabilityEnabled(),
    open: reloaded.save.mapFullyOpen(),
    progress: reloaded.save.savedProgress().at,
    reducedMotion: values.get(REDUCED_MOTION_KEY),
    skills: reloaded.save.savedSkills(),
    stats: reloaded.save.wholeRunStats(),
  }).toEqual({
    earned: [],
    invulnerable: true,
    open: false,
    progress: "beginning",
    reducedMotion: "on",
    skills: [],
    stats: { activeSeconds: 0, deaths: 0 },
  });
});
