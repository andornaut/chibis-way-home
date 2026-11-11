import { encodeSave } from "@andornaut/game-kit/save/versionedSave";
import { afterEach, expect, it, vi } from "vitest";

import { CHUNKS } from "../../data/chunks";
import { ZONE_MAP } from "../../data/map";
import { RECIPES } from "../../data/zones";
import { SKILL_IDS } from "../skills";
import { ACHIEVEMENT_KEYS } from "./achievements";
import { BEGINNING, PROGRESS_KEYS, progressFormat } from "./progress";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("grants stored ownership during practice without lifting its progress guard", async () => {
  const profile = {
    ...BEGINNING,
    activeSkill: "doubleJump" as const,
    at: "map" as const,
    completed: [],
    openingSeen: true,
    seenZoneIntros: [],
    skills: ["doubleJump" as const],
    stand: ZONE_MAP.start,
  };
  const encoded = encodeSave(
    progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS))),
    profile,
  );
  if (!encoded.ok) {
    throw new Error(encoded.reason);
  }
  const values = new Map<string, string>([[PROGRESS_KEYS.save, encoded.value]]);
  const setItem = vi.fn((key: string, value: string) => values.set(key, value));
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem });
  vi.stubGlobal("window", {
    document: { fullscreenElement: null },
    location: new URL("https://example.test/play/?devSession=1"),
    matchMedia: () => ({ matches: false }),
    navigator: {},
  });
  const save = await import("../../scenes/save");
  const page = await import("./pageSave");
  await save.loadProgress();
  expect(save.savedProgress().at).toBe("beginning");
  expect(await page.grantSavedSkills({ available: () => true })).toMatchObject({ status: "saved" });
  expect(save.savedProgress()).toMatchObject({
    ...profile,
    skills: ["doubleJump", "dash", "speedy"],
  });
  expect(new Set(save.savedSkills())).toEqual(new Set(SKILL_IDS));
  expect(save.activeSkill()).toBe("doubleJump");
  const stored = [...values];
  const count = setItem.mock.calls.length;
  expect(save.grantSkill("dash")).toBe(false);
  save.clearProgress();
  save.saveCompleted(ZONE_MAP.start);
  save.beginStageRun(ZONE_MAP.start);
  await save.flushStats();
  expect(save.selectActiveSkill("speedy")).toBe(true);
  expect(save.activeSkill()).toBe("speedy");
  expect([...values]).toEqual(stored);
  expect(setItem).toHaveBeenCalledTimes(count);
});

it("blocks explicit saved grants while a normal progress write is outstanding", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const page = await import("./pageSave");
  const session = { development: () => false, skillOverrides: () => ({}) };
  await page.loadProgress(session);
  expect(page.grantSkill(session, "doubleJump")).toBe(true);
  expect(await page.grantSavedSkills({ available: () => true })).toMatchObject({
    reason: "pending_progress_writes",
    status: "blocked",
    written: [],
  });
});

it("recovers one saved pending notice after cache adoption was blocked", async () => {
  const values = new Map<string, string>();
  let available = true;
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
      if (key === ACHIEVEMENT_KEYS.save) {
        available = false;
      }
    },
  });
  const page = await import("./pageSave");
  const session = { development: () => true, skillOverrides: () => ({}) };
  expect(await page.grantSavedSkills({ available: () => available })).toMatchObject({
    cause: "blocked",
    reason: "cache_commit_unavailable",
    status: "partial",
    written: ["progress", "achievements"],
  });
  available = true;
  expect(await page.grantSavedSkills({ available: () => available })).toMatchObject({
    status: "unchanged",
  });
  expect(page.nextAchievementNotice(session, () => false)).toBe("gift-rooms");
  expect(page.nextAchievementNotice(session, () => false)).toBeUndefined();
  await page.grantSavedSkills({ available: () => available });
  expect(page.nextAchievementNotice(session, () => false)).toBeUndefined();
  expect(JSON.parse(values.get(ACHIEVEMENT_KEYS.save)!).earned).toEqual(["gift-rooms"]);
});
