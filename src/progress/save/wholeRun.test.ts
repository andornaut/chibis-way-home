import { memoryStorage } from "@andornaut/game-kit/save/storage";
import { encodeSave } from "@andornaut/game-kit/save/versionedSave";
import { expect, it, vi } from "vitest";

import { wholeRunSummary } from "./runSummary";
import { stageStatsStore, STATS_VERSION, statsFormat } from "./stats";

const stageIds = ["first", "second"] as const;
const stages = new Set<string>(stageIds);
const destinations = [{ id: "zone", stages: stageIds }];
it("retains per-ID and whole-run totals across retries, stage replacement, visit changes and reopen", async () => {
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
  expect(clock.summary("first")).toMatchObject({
    attemptSeconds: 2.75,
    attempts: 2,
    cumulativeSeconds: 4,
  });
  expect(clock.summary("second").cumulativeSeconds).toBe(4);
  expect(clock.visitSummary("zone").cumulativeSeconds).toBe(8);
  await clock.flush();
  const reopened = stageStatsStore(storage, stages, destinations);
  await reopened.load();
  reopened.beginVisit("zone");
  reopened.beginRun("first");
  reopened.clearStage("first");
  expect(reopened.wholeRun()).toEqual({ activeSeconds: 8, deaths: 2 });
  expect(reopened.summary("first").cumulativeSeconds).toBe(4);
  expect(reopened.visitSummary("zone").cumulativeSeconds).toBe(8);
  reopened.addActiveTime("first", 1.5);
  expect(reopened.summary("first")).toMatchObject({
    attemptSeconds: 1.5,
    attempts: 1,
    cumulativeSeconds: 5.5,
  });
  expect(reopened.visitSummary("zone").cumulativeSeconds).toBe(9.5);
  expect(reopened.wholeRun().activeSeconds).toBe(9.5);
  const best = reopened.summary("second").bestSeconds;
  const zoneBest = reopened.visitSummary("zone").bestSeconds;
  reopened.resetWholeRun();
  await reopened.flush();
  expect(reopened.wholeRun()).toEqual({ activeSeconds: 0, deaths: 0 });
  expect(reopened.summary("first").cumulativeSeconds).toBe(0);
  expect(reopened.summary("second").cumulativeSeconds).toBe(0);
  expect(reopened.visitSummary("zone").cumulativeSeconds).toBe(0);
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

it("derives completed stages from progress without changing the whole-run counters", () => {
  const counters = { activeSeconds: 65.9, deaths: 2 };
  const summary = wholeRunSummary(
    ["first", "second"],
    ["first", "first", "fork", "unknown"],
    counters,
  );
  expect(summary).toEqual({ activeSeconds: 65.9, completed: 1, deaths: 2, total: 2 });
  expect(counters).toEqual({ activeSeconds: 65.9, deaths: 2 });
});

it("initializes missing cumulative maps once while preserving every saved counter", async () => {
  const legacy = {
    stages: {
      first: {
        bestSeconds: 2,
        run: { attemptSeconds: 3, attempts: 2, completed: false, runSeconds: 8 },
      },
    },
    visit: {
      stages: { first: { attemptSeconds: 3, attempts: 2, completed: false, runSeconds: 8 } },
      zone: "zone",
    },
    wholeRun: { activeSeconds: 42, deaths: 3 },
    zones: { zone: 5 },
  };
  const storage = memoryStorage();
  await storage.write(
    "chibis-way-home.stats",
    JSON.stringify({ ...legacy, version: STATS_VERSION }),
  );
  const writes = vi.spyOn(storage, "write");
  const clock = stageStatsStore(storage, stages, destinations);
  await clock.load();
  expect(clock.summary("first")).toEqual({
    attemptSeconds: 3,
    attempts: 2,
    bestSeconds: 2,
    cumulativeSeconds: 0,
    runSeconds: 8,
  });
  expect(clock.wholeRun()).toEqual(legacy.wholeRun);
  expect(clock.visitSummary("zone").cumulativeSeconds).toBe(0);
  expect(writes).toHaveBeenCalledOnce();
  expect(JSON.parse((await storage.read("chibis-way-home.stats"))!)).toMatchObject({
    ...legacy,
    totals: { stages: {}, zones: {} },
    version: STATS_VERSION,
  });
  clock.addActiveTime("first", 3);
  await clock.flush();
  const reopened = stageStatsStore(storage, stages, destinations);
  const writesBeforeReload = writes.mock.calls.length;
  await reopened.load();
  expect(writes).toHaveBeenCalledTimes(writesBeforeReload);
  expect(reopened.summary("first")).toMatchObject({
    attemptSeconds: 6,
    attempts: 2,
    bestSeconds: 2,
    cumulativeSeconds: 3,
    runSeconds: 11,
  });
  expect(reopened.visitSummary("zone")).toMatchObject({ bestSeconds: 5, cumulativeSeconds: 3 });
  expect(reopened.wholeRun()).toEqual({ activeSeconds: 45, deaths: 3 });
  reopened.beginVisit("zone");
  reopened.beginRun("first");
  reopened.addActiveTime("first", 2);
  expect(reopened.summary("first")).toMatchObject({
    attemptSeconds: 2,
    attempts: 1,
    cumulativeSeconds: 5,
  });
  expect(reopened.visitSummary("zone").cumulativeSeconds).toBe(5);
  expect(reopened.wholeRun().activeSeconds).toBe(47);
  await reopened.flush();
});
it.each([
  { stages: { unknown: 1 }, zones: {} },
  { stages: { first: -1 }, zones: {} },
  { stages: {}, zones: { unknown: 1 } },
])("rejects invalid cumulative IDs or durations %j", (totals) => {
  expect(
    encodeSave(statsFormat(stages, destinations), {
      stages: {},
      totals,
      wholeRun: { activeSeconds: 0, deaths: 0 },
      zones: {},
    }).ok,
  ).toBe(false);
});
