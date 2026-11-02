import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map";
import type { ZoneState } from "../rules/zone";
import { PROGRESS_VERSION } from "./progress";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("keeps browser progress normal until developer activation, then blocks mutation and lifecycle writes", async () => {
  const values = new Map<string, string>();
  const write = vi.fn((key: string, value: string) => values.set(key, value));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: write,
  });
  const window = new EventTarget() as EventTarget & { location: URL };
  window.location = new URL("https://example.test/play/");
  vi.stubGlobal("window", window);
  const document = Object.assign(new EventTarget(), { visibilityState: "hidden" });
  vi.stubGlobal("document", document);
  const save = await import("./index");
  await save.loadProgress();
  const stage = ZONE_MAP.start;
  save.beginStageRun(stage);
  await save.flushStats();
  expect(save.savedProgress().at).toBe("map");
  const before = JSON.stringify(save.savedProgress());
  const writes = write.mock.calls.length;
  window.location.search = "?devSession=1";
  save.beginZoneVisit("woodland");
  save.beginStageRun(stage);
  save.retryStageRun(stage);
  save.recordActiveStageStep(stage, 1, {} as ZoneState, {} as ZoneState);
  save.completeStageRun(stage);
  save.clearStageTime(stage);
  save.saveCompleted(stage);
  save.saveStand(stage);
  save.saveZoneIntro("woodland");
  expect(save.grantSkill("speedy")).toBe(false);
  save.clearProgress();
  save.resetWholeRunStats();
  expect(save.wholeRunStats()).toEqual({ activeSeconds: 0, deaths: 0 });
  window.dispatchEvent(new Event("pagehide"));
  document.dispatchEvent(new Event("visibilitychange"));
  await save.flushStats();
  await save.loadProgress();
  expect(write).toHaveBeenCalledTimes(writes);
  expect(JSON.stringify(save.savedProgress())).toBe(before);
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
])(
  "reads only validated $name skill ownership for direct Dev entry without restoring progress or writing",
  async ({ expected, raw }) => {
    vi.stubGlobal("window", { location: new URL("https://example.test/play/?devSession=1") });
    const read = vi.fn(() => JSON.stringify(raw)),
      write = vi.fn();
    vi.stubGlobal("localStorage", { getItem: read, setItem: write });
    const save = await import("./index");
    await save.loadProgress();
    expect(read).toHaveBeenCalledExactlyOnceWith("chibis-way-home.save");
    expect(save.savedSkills()).toEqual(expected);
    expect(save.savedProgress()).toEqual({
      activeSkill: null,
      at: "beginning",
      openingSeen: false,
      skills: [],
    });
    expect(save.grantSkill("speedy")).toBe(false);
    expect(write).not.toHaveBeenCalled();
  },
);
