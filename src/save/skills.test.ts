import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map";
import { SKILL_IDS } from "../rules/skills";

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
  const save = await import("./index");
  await save.loadProgress();
  SKILL_IDS.forEach((skill) => expect(save.grantSkill(skill)).toBe(true));
  await save.loadProgress();
  expect(save.activeSkill()).toBe(SKILL_IDS[0]);
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

it("keeps first and sole skills active and rejects unowned selection without writing", async () => {
  const write = vi.fn();
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: write });
  const save = await import("./index");
  await save.loadProgress();
  expect(save.selectActiveSkill("speedy")).toBe(false);
  expect(save.activeSkill()).toBeNull();
  save.grantSkill("doubleJump");
  expect(save.activeSkill()).toBe("doubleJump");
  expect(save.selectActiveSkill("dash")).toBe(false);
  save.grantSkill("dash");
  expect(save.activeSkill()).toBe("doubleJump");
});

it("keeps Dev-only selection temporary and falls back to saved ownership when an override is unchecked", async () => {
  const { PROGRESS_VERSION } = await import("./progress");
  const raw = JSON.stringify({
    activeSkill: "dash",
    at: "beginning",
    openingSeen: false,
    skills: ["dash"],
    version: PROGRESS_VERSION,
  });
  const write = vi.fn();
  vi.stubGlobal("localStorage", { getItem: () => raw, setItem: write });
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
  const save = await import("./index");
  await save.loadProgress();
  expect(save.activeSkill()).toBe("dash");
  expect(save.selectActiveSkill("speedy")).toBe(true);
  expect(save.activeSkill()).toBe("speedy");
  const { changeSkillOverride } = await import("../dev/mode");
  changeSkillOverride(host as unknown as Window, false, "speedy");
  expect(save.activeSkill()).toBe("dash");
  expect(save.selectActiveSkill("dash")).toBe(false);
  expect(save.savedProgress().activeSkill).toBeNull();
  expect(write).not.toHaveBeenCalled();
});

it("restores every permanent grant and the sole selection after a fresh page module loads", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const beforeExit = await import("./index");
  await beforeExit.loadProgress();
  for (const skill of SKILL_IDS) {
    beforeExit.grantSkill(skill);
  }
  beforeExit.selectActiveSkill("speedy");
  beforeExit.beginStageRun(ZONE_MAP.start);
  beforeExit.saveStand(ZONE_MAP.start);
  await beforeExit.loadProgress();
  vi.resetModules();
  const afterContinue = await import("./index");
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
