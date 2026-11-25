import { encodeSave, type SaveFormat } from "@andornaut/game-kit/runtime/save/versionedSave";
import { localSaveStorage } from "@andornaut/game-kit/runtime/web/save/dom/localSaveStorage";
import { expect, it, vi } from "vitest";

import { CHUNKS } from "../data/chunks.ts";
import { ZONE_MAP } from "../data/map.ts";
import { RECIPES } from "../data/zones.ts";
import {
  ACHIEVEMENT_IDS,
  ACHIEVEMENT_KEYS,
  ACHIEVEMENTS_FORMAT,
  PROGRESS_KEYS,
  progressFormat,
  STATS_KEYS,
  statsFormat,
} from "../progress/index.ts";
import { createPageSave } from "./pageSave.ts";

const { probeSaveAge, resetSave, resetSaveAvailable } = createPageSave(
  localSaveStorage(),
  () => false,
);

const encoded = <T>(format: SaveFormat<T>, save = format.fresh()): string => {
  const result = encodeSave(format, save);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.value;
};

it("probes current, corrupt, newer and unavailable saves without any mutation port or backup changes", async () => {
  const statistics = statsFormat(
    new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages)),
    ZONE_MAP.destinations,
  );
  const values = new Map<string, string>([
    [PROGRESS_KEYS.save, encoded(progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS))))],
    [ACHIEVEMENT_KEYS.save, encoded(ACHIEVEMENTS_FORMAT)],
    [STATS_KEYS.save, encoded(statistics)],
    [PROGRESS_KEYS.backup, "retained progress backup"],
    [ACHIEVEMENT_KEYS.backup, "retained achievement backup"],
    [STATS_KEYS.backup, "retained statistics backup"],
  ]);
  const source = { read: vi.fn(async (key: string) => values.get(key) ?? null) };
  let before = [...values];
  expect(await probeSaveAge(source)).toBe("current");
  expect([...values]).toEqual(before);
  values.set(PROGRESS_KEYS.save, "{corrupt");
  before = [...values];
  expect(await probeSaveAge(source)).toBe("current");
  expect([...values]).toEqual(before);
  values.set(
    STATS_KEYS.save,
    JSON.stringify({ ...JSON.parse(encoded(statistics)), version: statistics.version + 1 }),
  );
  before = [...values];
  expect(await probeSaveAge(source)).toBe("newer");
  expect([...values]).toEqual(before);
  source.read.mockRejectedValue(new Error("storage unavailable"));
  expect(await probeSaveAge(source)).toBe("unavailable");
  expect([...values]).toEqual(before);
  expect(new Set(source.read.mock.calls.map(([key]) => key))).toEqual(
    new Set([PROGRESS_KEYS.save, ACHIEVEMENT_KEYS.save, STATS_KEYS.save]),
  );
});

it("only resets valid persisted records with player data, preserving incompatible or unreadable saves", async () => {
  const progress = progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS)));
  const statistics = statsFormat(
    new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages)),
    ZONE_MAP.destinations,
  );
  const values = new Map<string, string>();
  const source = { read: vi.fn(async (key: string) => values.get(key) ?? null) };
  expect(await resetSaveAvailable(source)).toBe(false);
  values.set(PROGRESS_KEYS.save, encoded(progress));
  values.set(ACHIEVEMENT_KEYS.save, encoded(ACHIEVEMENTS_FORMAT));
  values.set(STATS_KEYS.save, encoded(statistics));
  expect(await resetSaveAvailable(source)).toBe(false);
  values.set(PROGRESS_KEYS.save, "{corrupt");
  expect(await resetSaveAvailable(source)).toBe(false);
  values.set(PROGRESS_KEYS.save, encoded(progress, { ...progress.fresh(), openingSeen: true }));
  expect(await resetSaveAvailable(source)).toBe(true);
  values.set(PROGRESS_KEYS.save, encoded(progress));
  const earned = ACHIEVEMENT_IDS[0]!;
  values.set(
    ACHIEVEMENT_KEYS.save,
    encoded(ACHIEVEMENTS_FORMAT, { earned: [earned], unannounced: [] }),
  );
  expect(await resetSaveAvailable(source)).toBe(true);
  values.set(ACHIEVEMENT_KEYS.save, encoded(ACHIEVEMENTS_FORMAT));
  values.set(
    STATS_KEYS.save,
    encoded(statistics, {
      ...statistics.fresh(),
      wholeRun: { activeSeconds: 1, deaths: 0 },
    }),
  );
  expect(await resetSaveAvailable(source)).toBe(true);
  values.set(PROGRESS_KEYS.save, JSON.stringify({ version: progress.version + 1 }));
  expect(await resetSaveAvailable(source)).toBe(false);
  values.set(PROGRESS_KEYS.save, encoded(progress));
  source.read.mockRejectedValue(new Error("unavailable"));
  expect(await resetSaveAvailable(source)).toBe(false);
});

it("guards programmatic Reset and uses actual failure results from each persisted record", async () => {
  const progress = progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS)));
  const statistics = statsFormat(
    new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages)),
    ZONE_MAP.destinations,
  );
  const realProgress = encoded(progress, { ...progress.fresh(), openingSeen: true });
  const realStats = encoded(statistics, {
    ...statistics.fresh(),
    wholeRun: { activeSeconds: 1, deaths: 0 },
  });
  const values = new Map([["device-preference", "on"]]);
  let statsUnavailable = false;
  const setItem = vi.fn((key: string, value: string) => {
    if (statsUnavailable && key === STATS_KEYS.save) {
      throw new Error("stats write unavailable");
    }
    values.set(key, value);
  });
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem });
  try {
    expect((await resetSave()).status).toBe("invalid");
    values.set(PROGRESS_KEYS.save, realProgress);
    values.set(STATS_KEYS.save, JSON.stringify({ version: statistics.version + 1 }));
    expect((await resetSave()).status).toBe("unavailable");
    expect(setItem).not.toHaveBeenCalled();

    values.set(STATS_KEYS.save, realStats);
    statsUnavailable = true;
    expect((await resetSave()).status).toBe("unavailable");
    expect(values.get(STATS_KEYS.save)).toBe(realStats);
    expect(await resetSaveAvailable()).toBe(true);

    statsUnavailable = false;
    expect(await resetSave()).toEqual({ status: "saved" });
    expect(await resetSaveAvailable()).toBe(false);
    expect((await resetSave()).status).toBe("invalid");
    expect(values.get("device-preference")).toBe("on");
  } finally {
    vi.unstubAllGlobals();
  }
});
