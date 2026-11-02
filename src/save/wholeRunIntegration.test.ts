import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map";
import type { ZoneState } from "../rules/zone";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("counts active death edges and retains whole-run totals across stage entry and retry", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const save = await import("./index");
  await save.loadProgress();
  const stage = ZONE_MAP.start;
  save.beginStageRun(stage);
  const before = {
    cleared: false,
    death: undefined,
    door: undefined,
    steps: 0,
    turnedBack: false,
  } as ZoneState;
  const moving = { ...before, steps: 1 };
  const dead = {
    ...moving,
    death: {
      position: { x: 0, y: 0 },
      reason: "fall",
      support: undefined,
      velocity: { x: 0, y: 0 },
    },
    steps: 2,
  } as ZoneState;
  save.recordActiveStageStep(stage, 0.25, before, moving);
  save.recordActiveStageStep(stage, 0.25, moving, dead);
  save.recordActiveStageStep(stage, 0.25, dead, { ...dead, steps: 3 });
  expect(save.wholeRunStats()).toEqual({ activeSeconds: 0.5, deaths: 1 });
  save.retryStageRun(stage);
  save.beginStageRun(stage);
  expect(save.wholeRunStats()).toEqual({ activeSeconds: 0.5, deaths: 1 });
  save.resetWholeRunStats();
  expect(save.wholeRunStats()).toEqual({ activeSeconds: 0, deaths: 0 });
});
