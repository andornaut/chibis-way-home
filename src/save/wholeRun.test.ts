import { memoryStorage } from "@andornaut/game-kit/save/storage";
import { encodeSave } from "@andornaut/game-kit/save/versionedSave";
import { expect, it } from "vitest";

import { formatWholeRunStats, wholeRunSummary } from "./runSummary";
import { stageStatsStore, statsFormat } from "./stats";

const stageIds = ["first", "second"] as const;
const stages = new Set<string>(stageIds);
const destinations = [{ id: "zone", stages: stageIds }];
it("retains whole-run time and deaths across retries, stage replacement, visit changes and reopen", async () => {
  const storage = memoryStorage(),
    clock = stageStatsStore(storage, stages, destinations);
  await clock.load();
  clock.beginVisit("zone");
  clock.beginRun("first");
  clock.addActiveTime("first", 1.25);
  clock.recordDeath("first");
  clock.retryStage("first");
  clock.addActiveTime("first", 2.75);
  clock.completeStage("first");
  clock.beginRun("second");
  clock.addActiveTime("second", 3);
  clock.recordDeath("second");
  clock.retryStage("second");
  clock.addActiveTime("second", 1);
  clock.completeStage("second");
  expect(clock.wholeRun()).toEqual({ activeSeconds: 8, deaths: 2 });
  await clock.flush();
  const reopened = stageStatsStore(storage, stages, destinations);
  await reopened.load();
  reopened.beginVisit("zone");
  reopened.beginRun("first");
  reopened.clearStage("first");
  expect(reopened.wholeRun()).toEqual({ activeSeconds: 8, deaths: 2 });
  const best = reopened.summary("second").bestSeconds;
  const zoneBest = reopened.visitSummary("zone").bestSeconds;
  reopened.resetWholeRun();
  await reopened.flush();
  expect(reopened.wholeRun()).toEqual({ activeSeconds: 0, deaths: 0 });
  expect(reopened.summary("second").bestSeconds).toBe(best);
  expect(reopened.visitSummary("zone").bestSeconds).toBe(zoneBest);
});
it("rejects a death without a live known stage run without altering whole-run totals", async () => {
  const clock = stageStatsStore(memoryStorage(), stages);
  await clock.load();
  expect(() => clock.recordDeath("missing")).toThrow("Unknown stats stage");
  expect(() => clock.recordDeath("first")).toThrow("active stage run");
  clock.beginRun("first");
  clock.addActiveTime("first", 1);
  clock.completeStage("first");
  expect(() => clock.recordDeath("first")).toThrow("active stage run");
  expect(clock.wholeRun()).toEqual({ activeSeconds: 1, deaths: 0 });
  await clock.flush();
});
it.each([
  { activeSeconds: -1, deaths: 0 },
  { activeSeconds: 0, deaths: 0.5 },
])("rejects invalid whole-run totals %j", (wholeRun) => {
  expect(encodeSave(statsFormat(stages), { stages: {}, wholeRun, zones: {} }).ok).toBe(false);
});

it("derives completed stages from progress and formats whole-run counters without duplicating progress", () => {
  const counters = { activeSeconds: 65.9, deaths: 2 };
  const summary = wholeRunSummary(
    ["first", "second"],
    ["first", "first", "fork", "unknown"],
    counters,
  );
  expect(summary).toEqual({ activeSeconds: 65.9, completed: 1, deaths: 2, total: 2 });
  expect(formatWholeRunStats("{time}|{deaths}|{completed}/{total}", summary)).toBe("1:05|2|1/2");
  expect(counters).toEqual({ activeSeconds: 65.9, deaths: 2 });
});
