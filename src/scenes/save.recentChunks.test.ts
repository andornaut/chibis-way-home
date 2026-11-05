import { afterEach, expect, it, vi } from "vitest";

import { CHUNKS } from "../data/chunks";
import { ZONE_MAP } from "../data/map";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("records a stage entry's middle chunks for its zone, keeps them on reopen and clears them on Restart", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const [known] = Object.keys(CHUNKS);
  const zone = ZONE_MAP.destinations[0]!;
  const save = await import("./save");
  await save.loadProgress();
  save.beginStageRun(zone.stages[0]!);
  save.recordStageChunks(zone.stages[0]!, [known!, "renamed-away"]);
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  vi.resetModules();
  const reopened = await import("./save");
  await reopened.loadProgress();
  const kept = reopened.savedRecentMiddleChunks(zone.id);
  reopened.clearProgress();
  expect({ cleared: reopened.savedRecentMiddleChunks(zone.id), kept }).toEqual({
    cleared: [],
    kept: [known],
  });
});
