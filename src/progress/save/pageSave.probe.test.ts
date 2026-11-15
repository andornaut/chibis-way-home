import { encodeSave, type SaveFormat } from "@andornaut/game-kit/runtime/save/versionedSave";
import { expect, it, vi } from "vitest";

import { CHUNKS } from "../../data/chunks.ts";
import { ZONE_MAP } from "../../data/map.ts";
import { RECIPES } from "../../data/zones.ts";
import { ACHIEVEMENT_KEYS, ACHIEVEMENTS_FORMAT } from "./achievements.ts";
import { probeSaveAge } from "./pageSave.ts";
import { PROGRESS_KEYS, progressFormat } from "./progress.ts";
import { STATS_KEYS, statsFormat } from "./stats.ts";

const encoded = <T>(format: SaveFormat<T>): string => {
  const result = encodeSave(format, format.fresh());
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
