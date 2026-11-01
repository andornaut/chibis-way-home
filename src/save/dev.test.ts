import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map";
import type { ZoneState } from "../rules/zone";

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
  save.clearProgress();
  window.dispatchEvent(new Event("pagehide"));
  document.dispatchEvent(new Event("visibilitychange"));
  await save.flushStats();
  await save.loadProgress();
  expect(write).toHaveBeenCalledTimes(writes);
  expect(JSON.stringify(save.savedProgress())).toBe(before);
});
it("does not read or back up production saves when opened directly in a developer URL", async () => {
  vi.stubGlobal("window", { location: new URL("https://example.test/play/?devSession=1") });
  const read = vi.fn(),
    write = vi.fn();
  vi.stubGlobal("localStorage", { getItem: read, setItem: write });
  const save = await import("./index");
  await save.loadProgress();
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
