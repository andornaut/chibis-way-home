import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import { PROGRESS_VERSION } from "../progress/index.ts";
import type { ZoneState } from "../rules/zone.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("persists catalogue progress, time and deaths with run-only cheats active", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const window = Object.assign(new EventTarget(), {
    document: { fullscreenElement: null },
    location: new URL("https://example.test/play/?devSession=1&invulnerable=1&skillDoubleJump=1"),
    matchMedia: () => ({ matches: false }),
    navigator: {},
  });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "hidden" }));
  const save = await import("./save.ts");
  await save.loadProgress();
  const stage = ZONE_MAP.start;
  save.beginZoneVisit(ZONE_MAP.destinations[0]!.id);
  save.beginStageRun(stage);
  save.recordActiveStageStep(
    stage,
    2,
    { steps: 0 } as ZoneState,
    { death: {}, steps: 1 } as ZoneState,
  );
  expect(save.grantSkill("dash")).toBe(true);
  save.saveCompleted(stage);
  window.dispatchEvent(new Event("pagehide"));
  document.dispatchEvent(new Event("visibilitychange"));
  await save.flushStats();
  await save.loadProgress();
  expect(save.savedMap().completed).toContain(stage);
  expect(save.savedSkills()).toEqual(["dash"]);
  expect(save.wholeRunStats()).toEqual({ activeSeconds: 2, deaths: 1 });
  expect(save.activeStageTime(stage)).toBe(2);
  expect(JSON.parse(values.get("chibis-way-home.save")!).completed).toContain(stage);
  expect(JSON.parse(values.get("chibis-way-home.stats")!).wholeRun.activeSeconds).toBe(2);
});
it.each([
  {
    expected: ["dash"],
    name: "valid",
    raw: {
      activeSkill: "dash",
      at: "beginning",
      openingSeen: true,
      skills: ["dash"],
      version: PROGRESS_VERSION,
    },
  },
  {
    expected: [],
    name: "invalid",
    raw: {
      activeSkill: null,
      at: "beginning",
      openingSeen: true,
      skills: ["fly"],
      version: PROGRESS_VERSION,
    },
  },
  {
    expected: [],
    name: "old",
    raw: { activeSkill: null, at: "beginning", openingSeen: true, version: PROGRESS_VERSION - 1 },
  },
])("loads ordinary validated $name progress for direct cheat entry", async ({ expected, raw }) => {
  vi.stubGlobal("window", {
    document: { fullscreenElement: null },
    location: new URL("https://example.test/play/?devSession=1"),
    matchMedia: () => ({ matches: false }),
    navigator: {},
  });
  const values = new Map<string, string>([["chibis-way-home.save", JSON.stringify(raw)]]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const save = await import("./save.ts");
  await save.loadProgress();
  expect(save.savedSkills()).toEqual(expected);
  expect(save.savedProgress().at).toBe("beginning");
  expect(save.savedProgress().activeSkill).toBe(expected[0] ?? null);
  expect(save.grantSkill("speedy")).toBe(true);
});
