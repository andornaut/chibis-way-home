import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import type { ZoneState } from "../rules/zone.ts";

const PROGRESS_KEY = "chibis-way-home.save";
const ACHIEVEMENTS_KEY = "chibis-way-home.achievements";
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
  save: await import("./save.ts"),
});

const stages = ZONE_MAP.destinations.flatMap((zone) => zone.stages);

// Returning to the start screen ends the session, so Continue loads the save from before it.
it("writes nothing during a cheat session and restores the pre-cheat save when it ends", async () => {
  const values = storage();
  const { mode, save } = await page();
  await save.loadProgress();
  save.beginZoneVisit(ZONE_MAP.destinations[0]!.id);
  save.beginStageRun(ZONE_MAP.start);
  save.recordActiveStageStep(
    ZONE_MAP.start,
    3,
    { steps: 0 } as ZoneState,
    { steps: 1 } as ZoneState,
  );
  await save.flushStats();
  const before = { progress: save.savedProgress(), stats: save.wholeRunStats() };
  const stored = new Map(values);

  save.startCheatSession();
  mode.unlockAllPowerUps();
  mode.unlockAllZones();
  expect(save.activeSkill()).toBeNull();
  expect(save.grantSkill("dash")).toBe(true);
  expect(save.selectActiveSkill("dash")).toBe(true);
  save.recordActiveStageStep(
    ZONE_MAP.start,
    2,
    { steps: 1 } as ZoneState,
    { death: {}, steps: 2 } as ZoneState,
  );
  save.saveCompleted(ZONE_MAP.start);
  save.saveStand(stages[1]!);
  save.completeStageRun(ZONE_MAP.start);
  await save.flushStats();
  expect(save.savedMap().completed).toContain(ZONE_MAP.start);
  expect(save.mapFullyOpen()).toBe(true);
  expect(values).toEqual(stored);

  save.endCheatSession();
  expect({
    open: save.mapFullyOpen(),
    progress: save.savedProgress(),
    session: mode.isDevelopmentSession(),
    skills: save.savedSkills(),
    stats: save.wholeRunStats(),
  }).toEqual({
    open: false,
    progress: before.progress,
    session: false,
    skills: [],
    stats: before.stats,
  });
  save.saveCompleted(ZONE_MAP.start);
  await save.flushStats();
  expect(JSON.parse(values.get(PROGRESS_KEY)!).completed).toEqual([ZONE_MAP.start]);
});

it("applies cheats chosen before play to the play that follows; a reload has none", async () => {
  const values = storage();
  const first = await page();
  await first.save.loadProgress();
  first.save.startCheatSession();
  first.mode.setInvulnerability(true);
  first.mode.setSkillOverride(true, "speedy");
  first.save.saveOpeningSeen();
  first.save.beginZoneVisit(ZONE_MAP.destinations[0]!.id);
  first.save.beginStageRun(ZONE_MAP.start);
  await first.save.flushStats();
  expect(first.mode.invulnerabilityEnabled()).toBe(true);
  expect(first.save.activeSkill()).toBeNull();
  expect(values.size).toBe(0);

  vi.resetModules();
  const reloaded = await page();
  await reloaded.save.loadProgress();
  expect({
    invulnerable: reloaded.mode.invulnerabilityEnabled(),
    overrides: reloaded.mode.developmentSkillOverrides(),
    progress: reloaded.save.savedProgress().at,
    session: reloaded.mode.isDevelopmentSession(),
    stored: values.size,
  }).toEqual({
    invulnerable: false,
    overrides: {},
    progress: "beginning",
    session: false,
    stored: 0,
  });
});

it("resets progress, statistics and achievements and keeps device settings", async () => {
  const values = storage([[REDUCED_MOTION_KEY, "on"]]);
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
  ["dash", "doubleJump", "speedy"].forEach((skill) =>
    first.save.grantSkill(skill as "dash" | "doubleJump" | "speedy"),
  );
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
    progress: reloaded.save.savedProgress().at,
    reducedMotion: values.get(REDUCED_MOTION_KEY),
    skills: reloaded.save.savedSkills(),
    stats: reloaded.save.wholeRunStats(),
  }).toEqual({
    earned: [],
    progress: "beginning",
    reducedMotion: "on",
    skills: [],
    stats: { activeSeconds: 0, deaths: 0 },
  });
});
