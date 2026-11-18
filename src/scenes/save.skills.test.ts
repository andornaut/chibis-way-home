import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import type { SkillId } from "../data/types/index.ts";
import { SKILL_IDS } from "../progress/index.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("persists each room grant once through progress writes and reopen, then resets ownership on Restart", async () => {
  const values = new Map<string, string>();
  const write = vi.fn((key: string, value: string) => values.set(key, value));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: write,
  });
  const save = await import("./save.ts");
  await save.loadProgress();
  SKILL_IDS.forEach((skill) => expect(save.grantSkill(skill)).toBe(true));
  await save.loadProgress();
  expect(save.activeSkill()).toBeNull();
  expect(save.selectActiveSkill("speedy")).toBe(true);
  expect(save.activeSkill()).toBe("speedy");
  const writes = write.mock.calls.length;
  SKILL_IDS.forEach((skill) => expect(save.grantSkill(skill)).toBe(false));
  expect(save.selectActiveSkill("speedy")).toBe(false);
  await save.loadProgress();
  expect(write).toHaveBeenCalledTimes(writes);
  save.saveOpeningSeen();
  save.beginStageRun(ZONE_MAP.start);
  save.saveZoneIntro(ZONE_MAP.destinations[0]!.id);
  save.saveCompleted(ZONE_MAP.start);
  save.saveStand(ZONE_MAP.start);
  await save.loadProgress();
  expect(save.savedSkills()).toEqual(SKILL_IDS);
  expect(save.activeSkill()).toBe("speedy");
  save.clearProgress();
  await save.loadProgress();
  expect(save.savedSkills()).toEqual([]);
  expect(save.activeSkill()).toBeNull();
});

it("leaves the first gift unselected and tipped, turns a selection off and rejects unowned selection", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const save = await import("./save.ts");
  await save.loadProgress();
  expect(save.activeSkill()).toBeNull();
  expect(save.selectActiveSkill("speedy")).toBe(false);
  save.grantSkill("doubleJump");
  expect(save.savedSkills()).toEqual(["doubleJump"]);
  expect(save.activeSkill()).toBeNull();
  expect(save.nextTip(() => false)).toEqual({ id: "powerUp", skill: "doubleJump" });
  expect(save.selectActiveSkill("dash")).toBe(false);
  expect(save.selectActiveSkill("doubleJump")).toBe(true);
  expect(save.selectActiveSkill("doubleJump")).toBe(false);
  expect(save.selectActiveSkill(null)).toBe(true);
  expect(save.selectActiveSkill(null)).toBe(false);
  await save.loadProgress();
  expect(save.activeSkill()).toBeNull();
  expect(save.selectActiveSkill("doubleJump")).toBe(true);
  expect(save.activeSkill()).toBe("doubleJump");
  save.beginStageRun(ZONE_MAP.start);
  await save.loadProgress();
  expect(save.activeSkill()).toBe("doubleJump");
  save.grantSkill("dash");
  expect(save.activeSkill()).toBe("doubleJump");
});

it("triggers each tip once a playthrough, behind unlock notices, saved as seen until Restart", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  vi.stubGlobal("localStorage", storage);
  const open = () => false;
  const save = await import("./save.ts");
  const page = await import("../progress/save/pageSave.ts");
  await save.loadProgress();
  save.beginStageRun(ZONE_MAP.start);
  page.triggerTips(["doors", "doors"]);
  expect(save.nextTip(() => true)).toBeUndefined();
  expect([save.nextTip(open), save.nextTip(open), save.nextTip(open)]).toEqual([
    { id: "controls" },
    { id: "doors" },
    undefined,
  ]);
  page.triggerTips(["doors"]);
  save.beginStageRun(ZONE_MAP.start);
  expect(save.nextTip(open)).toBeUndefined();
  SKILL_IDS.forEach((skill) => save.grantSkill(skill));
  // Owning every skill unlocks an achievement, whose notice comes first.
  expect(save.nextTip(open)).toBeUndefined();
  expect(save.nextAchievementNotice(open)).toBe("gift-rooms");
  const [first, second, third] = SKILL_IDS as [SkillId, SkillId, SkillId];
  expect(Array.from({ length: 5 }, () => save.nextTip(open))).toEqual([
    { id: "powerUp", skill: first },
    { id: "powerUp", skill: second },
    { id: "secondPowerUp" },
    { id: "powerUp", skill: third },
    undefined,
  ]);
  await save.loadProgress();
  vi.resetModules();
  const reopened = await import("./save.ts");
  const reopenedPage = await import("../progress/save/pageSave.ts");
  await reopened.loadProgress();
  expect(reopened.savedProgress().seenTips).toEqual([
    "controls",
    "doors",
    `powerUp:${first}`,
    `powerUp:${second}`,
    "secondPowerUp",
    `powerUp:${third}`,
  ]);
  reopenedPage.triggerTips(["doors", "hazards"]);
  expect([reopened.nextTip(open), reopened.nextTip(open)]).toEqual([{ id: "hazards" }, undefined]);
  reopened.clearProgress();
  expect(reopened.savedProgress().seenTips).toEqual([]);
  reopenedPage.triggerTips(["doors"]);
  expect(reopened.nextTip(open)).toEqual({ id: "doors" });
});

it("queues each distinct grant's power-up tip once and none for a duplicate grant", async () => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  const save = await import("./save.ts");
  await save.loadProgress();
  const open = () => false;
  const [first, second, third] = SKILL_IDS as [SkillId, SkillId, SkillId];
  save.grantSkill(first);
  expect(save.nextTip(open)).toEqual({ id: "powerUp", skill: first });
  expect(save.grantSkill(first)).toBe(false);
  save.grantSkill(second);
  expect(save.grantSkill(second)).toBe(false);
  expect([save.nextTip(open), save.nextTip(open)]).toEqual([
    { id: "powerUp", skill: second },
    { id: "secondPowerUp" },
  ]);
  save.grantSkill(third);
  expect(save.grantSkill(third)).toBe(false);
  // Owning every skill unlocks an achievement, whose notice comes first.
  save.nextAchievementNotice(open);
  expect([save.nextTip(open), save.nextTip(open)]).toEqual([
    { id: "powerUp", skill: third },
    undefined,
  ]);
});

it("keeps a cheat-enabled selection temporary and falls back to saved ownership", async () => {
  const { PROGRESS_VERSION } = await import("../progress/index.ts");
  const raw = JSON.stringify({
    activeSkill: "dash",
    at: "beginning",
    openingSeen: false,
    seenTips: [],
    skills: ["dash"],
    version: PROGRESS_VERSION,
  });
  const values = new Map<string, string>([["chibis-way-home.save", raw]]);
  const write = vi.fn((key: string, value: string) => values.set(key, value));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: write,
  });
  const save = await import("./save.ts");
  const mode = await import("../dev/mode.ts");
  await save.loadProgress();
  save.startCheatSession();
  mode.setSkillOverride(true, "speedy");
  expect(save.activeSkill()).toBe("dash");
  expect(save.selectActiveSkill("speedy")).toBe(true);
  expect(save.activeSkill()).toBe("speedy");
  expect(save.selectActiveSkill(null)).toBe(true);
  expect(save.activeSkill()).toBeNull();
  expect(save.selectActiveSkill("speedy")).toBe(true);
  mode.setSkillOverride(false, "speedy");
  expect(save.activeSkill()).toBe("dash");
  expect(save.selectActiveSkill("dash")).toBe(false);
  expect(save.savedProgress().activeSkill).toBe("dash");
  expect(values.get("chibis-way-home.save")).toBe(raw);
  save.endCheatSession();
  expect(save.grantSkill("doubleJump")).toBe(true);
  expect(save.selectActiveSkill("doubleJump")).toBe(true);
  await save.loadProgress();
  expect(save.savedProgress().activeSkill).toBe("doubleJump");
  expect(JSON.parse(values.get("chibis-way-home.save")!).activeSkill).toBe("doubleJump");
});

it("keeps an existing save's selection on load", async () => {
  const { PROGRESS_VERSION } = await import("../progress/index.ts");
  const raw = JSON.stringify({
    activeSkill: "speedy",
    at: "beginning",
    openingSeen: true,
    seenTips: [],
    skills: ["dash", "speedy"],
    version: PROGRESS_VERSION,
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (key === "chibis-way-home.save" ? raw : null),
    setItem: vi.fn(),
  });
  const save = await import("./save.ts");
  await save.loadProgress();
  expect(save.activeSkill()).toBe("speedy");
  expect(save.grantSkill("doubleJump")).toBe(true);
  expect(save.activeSkill()).toBe("speedy");
});

it("restores every permanent grant and the sole selection after a fresh page module loads", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const beforeExit = await import("./save.ts");
  await beforeExit.loadProgress();
  for (const skill of SKILL_IDS) {
    beforeExit.grantSkill(skill);
  }
  beforeExit.selectActiveSkill("speedy");
  beforeExit.beginStageRun(ZONE_MAP.start);
  beforeExit.saveStand(ZONE_MAP.start);
  await beforeExit.loadProgress();
  vi.resetModules();
  const afterContinue = await import("./save.ts");
  await afterContinue.loadProgress();
  expect(afterContinue.savedSkills()).toEqual(SKILL_IDS);
  expect(afterContinue.activeSkill()).toBe("speedy");
  expect(afterContinue.savedMap().stand).toBe(ZONE_MAP.start);
  for (const skill of SKILL_IDS) {
    expect(afterContinue.grantSkill(skill)).toBe(false);
  }
  expect(afterContinue.selectActiveSkill("dash")).toBe(true);
  expect(afterContinue.savedSkills()).toEqual(SKILL_IDS);
});
