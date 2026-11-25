import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";
import { afterEach, expect, it, vi } from "vitest";

import { CHUNKS } from "../data/chunks.ts";
import { ZONE_MAP } from "../data/map.ts";
import { createPageSave } from "../progress/save/pageSave.ts";
import { createSave } from "./save.ts";

// A page save of its own over the stubbed localStorage.
const openSave = () => createSave(createPageSave(localSaveStorage(), () => false));

afterEach(() => {
  vi.unstubAllGlobals();
});

it("records a stage entry's middle chunks, avoids them in its zone and clears them on Restart", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const [known] = Object.keys(CHUNKS);
  const zone = ZONE_MAP.destinations[0]!;
  const save = openSave();
  await save.loadProgress();
  save.beginStageRun(zone.stages[0]!);
  save.recordStageChunks(zone.stages[0]!, [known!, "renamed-away"]);
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  const reopened = openSave();
  await reopened.loadProgress();
  const kept = reopened.savedRecentMiddleChunks(zone.id);
  const avoided = zone.stages.map((stage) => reopened.recentStageChunks(stage));
  reopened.clearProgress();
  expect({ avoided, cleared: reopened.savedRecentMiddleChunks(zone.id), kept }).toEqual({
    avoided: zone.stages.map(() => [[known]]),
    cleared: [],
    kept: [[known]],
  });
});
