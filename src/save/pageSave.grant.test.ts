import { encodeSave } from "@andornaut/game-kit/runtime/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";
import { afterEach, expect, it, vi } from "vitest";

import { CHUNKS } from "../data/chunks.ts";
import { ZONE_MAP } from "../data/map.ts";
import { RECIPES } from "../data/zones.ts";
import {
  ACHIEVEMENT_KEYS,
  ACHIEVEMENTS_FORMAT,
  BEGINNING,
  PROGRESS_KEYS,
  progressFormat,
} from "../progress/index.ts";
import { createPageSave } from "./pageSave.ts";

// A page save of its own over the stubbed localStorage.
const openPageSave = () => createPageSave(localSaveStorage(), () => false);
afterEach(() => {
  vi.unstubAllGlobals();
});

it("keeps an owned but unselected save unselected when a later gift arrives", async () => {
  const raw = encodeSave(progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS))), {
    ...BEGINNING,
    skills: ["dash"],
  });
  if (!raw.ok) {
    throw new Error(raw.reason);
  }
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (key === PROGRESS_KEYS.save ? raw.value : null),
    setItem: vi.fn(),
  });
  const page = openPageSave();
  await page.loadProgress();
  expect(page.grantSkill("doubleJump")).toBe(true);
  expect(page.activeSkill()).toBeNull();
  expect(page.savedSkills()).toEqual(["dash", "doubleJump"]);
});

it("keeps same-zone gifts and clears them only on committed other-zone entry", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const initialPage = openPageSave();
  await initialPage.loadProgress();
  const first = ZONE_MAP.destinations[0]!;
  const other = ZONE_MAP.destinations[1]!;
  initialPage.unlockAllZones();
  initialPage.beginStageRun(first.stages[0]);
  const prepared = initialPage.prepareStageGift(first.stages[0], 7)!;
  expect(initialPage.savedProgress().giftVisit).toBeNull();
  initialPage.commitStageGift(prepared);
  initialPage.grantSkill("dash");
  initialPage.selectActiveSkill("dash");
  initialPage.saveStand(other.stages[0]);
  initialPage.saveStand(first.stages[0]);
  initialPage.saveZoneIntro(first.id);
  initialPage.saveCompleted(first.stages[0]);
  const replay = initialPage.prepareStageGift(first.stages[1]!, 999)!;
  expect(replay.visit).toEqual(prepared.visit);
  initialPage.commitStageGift(replay);
  initialPage.retryStageRun(first.stages[0]);
  await initialPage.settleWrites();
  const page = openPageSave();
  await page.loadProgress();
  expect([page.savedProgress().giftVisit, page.savedSkills(), page.activeSkill()]).toEqual([
    prepared.visit,
    ["dash"],
    "dash",
  ]);
  const leaving = page.prepareStageGift(other.stages[0], 19)!;
  expect(page.savedSkills()).toEqual(["dash"]);
  page.commitStageGift(leaving);
  expect([page.savedSkills(), page.activeSkill()]).toEqual([[], null]);
  page.grantSkill("doubleJump");
  expect(page.achievementCard().find(({ id }) => id === "gift-rooms")?.progress).toEqual({
    have: 2,
    need: 3,
  });
  const returning = page.prepareStageGift(first.stages[0], 23)!;
  page.commitStageGift(returning);
  expect(returning.visit).toEqual({ seed: 23, zone: first.id });
  page.grantSkill("speedy");
  expect([page.savedSkills(), page.activeSkill()]).toEqual([["speedy"], null]);
  expect(page.savedProgress().journeyGiftSkills).toEqual(["dash", "doubleJump", "speedy"]);
  expect(page.achievementCard().find(({ id }) => id === "gift-rooms")?.earned).toBe(true);
  expect(page.grantSkill("speedy")).toBe(false);
  expect(() => page.commitStageGift(leaving)).toThrow("no longer current");
  expect(page.savedSkills()).toEqual(["speedy"]);
  page.beginStageRun(ZONE_MAP.finish);
  page.completeStageRun(ZONE_MAP.finish);
  expect(page.achievementCard().find(({ id }) => id === "home-without-skills")?.earned).toBe(true);
  await page.settleWrites();
});

it("resets old progress without resetting separately earned achievements", async () => {
  const earned = encodeSave(ACHIEVEMENTS_FORMAT, { earned: ["gift-rooms"], unannounced: [] });
  if (!earned.ok) {
    throw new Error(earned.reason);
  }
  const values = new Map<string, string>([
    [PROGRESS_KEYS.save, JSON.stringify({ ...BEGINNING, skills: ["dash"], version: 13 })],
    [ACHIEVEMENT_KEYS.save, earned.value],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const page = openPageSave();
  await page.loadProgress();
  expect(page.savedProgress()).toEqual(BEGINNING);
  expect(page.achievementCard().find(({ id }) => id === "gift-rooms")?.earned).toBe(true);
  await page.settleWrites();
});
