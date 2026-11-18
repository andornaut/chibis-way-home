import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
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
  expect(save.nextTip(() => false)).toEqual({ id: "firstPowerUp", skill: "doubleJump" });
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
  expect([save.nextTip(open), save.nextTip(open), save.nextTip(open)]).toEqual([
    { id: "firstPowerUp", skill: SKILL_IDS[0] },
    { id: "secondPowerUp" },
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
    "firstPowerUp",
    "secondPowerUp",
  ]);
  reopenedPage.triggerTips(["doors", "hazards"]);
  expect([reopened.nextTip(open), reopened.nextTip(open)]).toEqual([{ id: "hazards" }, undefined]);
  reopened.clearProgress();
  expect(reopened.savedProgress().seenTips).toEqual([]);
  reopenedPage.triggerTips(["doors"]);
  expect(reopened.nextTip(open)).toEqual({ id: "doors" });
});

it("keeps Dev-only selection temporary and falls back to saved ownership when an override is unchecked", async () => {
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
  const url = new URL("https://example.test/play/?devSession=1&skillSpeedy=1");
  const host = {
    document: { fullscreenElement: null },
    history: {
      replaceState: (_state: unknown, _title: string, next: URL) => {
        url.href = next.href;
      },
      state: null,
    },
    location: url,
    matchMedia: () => ({ matches: false }),
    navigator: {},
  };
  vi.stubGlobal("window", host);
  const save = await import("./save.ts");
  await save.loadProgress();
  expect(save.activeSkill()).toBe("dash");
  expect(save.selectActiveSkill("speedy")).toBe(true);
  expect(save.activeSkill()).toBe("speedy");
  expect(save.selectActiveSkill(null)).toBe(true);
  expect(save.activeSkill()).toBeNull();
  expect(save.selectActiveSkill("speedy")).toBe(true);
  const { changeSkillOverride } = await import("../dev/mode.ts");
  changeSkillOverride(host as unknown as Window, false, "speedy");
  expect(save.activeSkill()).toBe("dash");
  expect(save.selectActiveSkill("dash")).toBe(false);
  expect(save.savedProgress().activeSkill).toBe("dash");
  expect(values.get("chibis-way-home.save")).toBe(raw);
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
