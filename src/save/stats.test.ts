import { memoryStorage } from "@andornaut/game-kit/save/storage";
import { encodeSave, loadSave } from "@andornaut/game-kit/save/versionedSave";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BIRD } from "../data/bird";
import { activeStepSeconds } from "../rules/death";
import { zoneLayout } from "../rules/tiles";
import { startZone, stepZone, type ZoneState } from "../rules/zone";
import { BIRD_FRAME } from "../view/bird";
import { stageStatsStore, STATS_VERSION, statsFormat } from "./stats";

const STAGES = new Set(["park", "street"]);
const FORMAT = statsFormat(STAGES);

describe("persistent active stage clocks", () => {
  it("coalesces active steps into one checkpoint and makes explicit flush idempotent", async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const writes = vi.spyOn(storage, "write");
    const clock = stageStatsStore(storage, STAGES);
    await clock.load();
    for (let step = 0; step < 60; step++) {
      clock.addActiveTime("street", 1 / 60);
    }
    expect(writes).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    await vi.runOnlyPendingTimersAsync();
    expect(writes).toHaveBeenCalledTimes(1);
    clock.addActiveTime("street", 2);
    clock.addActiveTime("street", 3);
    await clock.flush();
    await clock.flush();
    expect(writes).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    const reopened = stageStatsStore(storage, STAGES);
    await reopened.load();
    expect(reopened.seconds("street")).toBeCloseTo(6);
  });
  it("retains independent unfinished clocks across reopen and resets each clear", async () => {
    const storage = memoryStorage();
    const first = stageStatsStore(storage, STAGES);
    await first.load();
    first.addActiveTime("street", 1.5);
    first.addActiveTime("park", 2);
    first.addActiveTime("street", 0.5);
    await first.flush();
    const reopened = stageStatsStore(storage, STAGES);
    await reopened.load();
    expect([reopened.seconds("street"), reopened.seconds("park")]).toEqual([2, 2]);
    reopened.clearStage("street");
    reopened.addActiveTime("street", 3);
    reopened.clearStage("street");
    await reopened.flush();
    const again = stageStatsStore(storage, STAGES);
    await again.load();
    expect([again.seconds("street"), again.seconds("park")]).toEqual([0, 2]);
  });

  it.each([
    { stages: { street: { activeSeconds: -1 } } },
    { stages: { street: { activeSeconds: "1" } } },
    { stages: { unbuilt: { activeSeconds: 1 } } },
    { stages: [] },
  ])("refuses invalid stats %j", (value) => {
    expect(loadSave(FORMAT, JSON.stringify({ ...value, version: STATS_VERSION })).status).toBe(
      "corrupt",
    );
    expect(encodeSave(FORMAT, value as never).ok).toBe(false);
  });

  it("keeps memory clocks when storage is unavailable", async () => {
    const unavailable = {
      read: async () => {
        throw new Error("blocked");
      },
      write: async () => {
        throw new Error("blocked");
      },
    };
    const clock = stageStatsStore(unavailable, STAGES);
    await clock.load();
    clock.addActiveTime("street", 1);
    await clock.flush();
    expect(clock.seconds("street")).toBe(1);
  });
});

const LAYOUT = zoneLayout(12, BIRD_FRAME, { archetypes: {}, characters: {} }, {}, {}, new Set(), {
  areas: {
    course: {
      cols: 60,
      entries: { start: { col: 4, row: 20 } },
      objects: [],
      rows: 30,
      solids: [{ col: 0, cols: 60, row: 20, rows: 10 }],
    },
  },
  start: { area: "course", entry: "start" },
});
const INPUT = { jumpHeld: false, move: 0 as const, useHeld: false };
const INITIAL = startZone(BIRD, LAYOUT, 1);
const ACTIVE = stepZone(BIRD, LAYOUT, 0.1, INPUT, INITIAL);

describe("active-step time", () => {
  it.each<[string, ZoneState, ZoneState, number]>([
    ["active physics", INITIAL, ACTIVE, 0.1],
    [
      "linked-area clock reset",
      { ...ACTIVE, area: "lower", seconds: 10, steps: 10 },
      { ...ACTIVE, area: "upper", seconds: 0, steps: 11 },
      0.1,
    ],
    ["paused/dialogue/modal hold", INITIAL, INITIAL, 0],
    [
      "death hold",
      {
        ...INITIAL,
        death: {
          position: { x: 0, y: 0 },
          reason: "hazard",
          support: undefined,
          velocity: { x: 0, y: 0 },
        },
      },
      ACTIVE,
      0,
    ],
    ["cleared stage", { ...INITIAL, cleared: true }, ACTIVE, 0],
    ["returned to map", { ...INITIAL, turnedBack: true }, ACTIVE, 0],
    ["room", { ...INITIAL, door: 0 }, ACTIVE, 0],
  ])("counts %s", (_, before, after, seconds) => {
    expect(activeStepSeconds(0.1, before, after)).toBe(seconds);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("preserves stats on progress restart, then resets the stage on every clear", async () => {
  const values = new Map<string, string>([
    [
      "bird-versus-ferret.stats",
      JSON.stringify({
        stages: { park: { activeSeconds: 2 }, street: { activeSeconds: 3 } },
        version: STATS_VERSION - 1,
      }),
    ],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const save = await import("./index");
  await save.loadProgress();
  expect(values.has("bird-versus-ferret.stats-backup")).toBe(true);
  expect(save.activeStageTime("street")).toBe(0);
  save.recordActiveStageStep("park", 0.1, INITIAL, ACTIVE);
  expect(save.activeStageTime("park")).toBe(0);
  save.recordActiveStageStep("street", 0.1, INITIAL, ACTIVE);
  save.clearProgress();
  await save.flushStats();
  expect(save.activeStageTime("street")).toBe(0.1);
  expect(values.has("bird-versus-ferret.stats")).toBe(true);
  save.saveCompleted("street");
  await save.flushStats();
  expect(save.activeStageTime("street")).toBe(0);
});

it("resets version-two level clocks without migrating them", () => {
  const raw = JSON.stringify({ levels: { street: { activeSeconds: 65 } }, version: 2 });
  expect(loadSave(FORMAT, raw)).toMatchObject({ save: { stages: {} }, status: "corrupt" });
});
