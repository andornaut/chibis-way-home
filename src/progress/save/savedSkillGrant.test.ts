import { memoryStorage } from "@andornaut/game-kit/save/storage";
import { encodeSave } from "@andornaut/game-kit/save/versionedSave";
import { expect, it, vi } from "vitest";

import { CHUNKS } from "../../data/chunks";
import { ZONE_MAP } from "../../data/map";
import { RECIPES } from "../../data/zones";
import { SKILL_IDS } from "../skills";
import { ACHIEVEMENT_KEYS, ACHIEVEMENTS_FORMAT } from "./achievements";
import { BEGINNING, type Progress, PROGRESS_KEYS, progressFormat } from "./progress";
import { grantStoredSkills } from "./savedSkillGrant";
import { STATS_KEYS, statsFormat } from "./stats";
const profileFormat = progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS)));
const totalsFormat = statsFormat(
  new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages)),
  ZONE_MAP.destinations,
);
const encoded = <T>(format: Parameters<typeof encodeSave<T>>[0], value: T): string => {
  const result = encodeSave(format, value);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.value;
};
function fixture(speedy = false) {
  const profile: Progress = {
    ...BEGINNING,
    activeSkill: speedy ? "speedy" : "doubleJump",
    at: "map",
    completed: [],
    openingSeen: true,
    recent: {},
    seenZoneIntros: [],
    skills: [speedy ? "speedy" : "doubleJump"],
    stand: ZONE_MAP.start,
  };
  const stats = {
    ...totalsFormat.fresh(),
    totals: { stages: {}, zones: {} },
    wholeRun: { activeSeconds: 42, deaths: 3, skillUsed: false },
  };
  const earned = { earned: ["escape-archie" as const], unannounced: [] };
  const values = new Map([
    [PROGRESS_KEYS.save, encoded(profileFormat, profile)],
    [STATS_KEYS.save, encoded(totalsFormat, stats)],
    [ACHIEVEMENT_KEYS.save, encoded(ACHIEVEMENTS_FORMAT, earned)],
  ]);
  return { earned, profile, stats, storage: memoryStorage(values), values };
}
it("grants ownership while preserving saved map, selection, statistics and achievements", async () => {
  const { earned, stats, storage, values } = fixture();
  const committed = vi.fn();
  const storedProfile = JSON.parse(values.get(PROGRESS_KEYS.save)!);
  const result = await grantStoredSkills({ available: () => true, committed }, storage);
  expect(result.status).toBe("saved");
  expect(result.written).toEqual(["progress", "achievements"]);
  expect(JSON.parse(values.get(PROGRESS_KEYS.save)!)).toEqual({
    ...storedProfile,
    skills: ["doubleJump", "dash", "speedy"],
    version: profileFormat.version,
  });
  expect(JSON.parse(values.get(STATS_KEYS.save)!)).toEqual({
    ...stats,
    version: totalsFormat.version,
  });
  expect(JSON.parse(values.get(ACHIEVEMENT_KEYS.save)!)).toEqual({
    earned: [...earned.earned, "gift-rooms"],
    unannounced: ["gift-rooms"],
    version: ACHIEVEMENTS_FORMAT.version,
  });
  expect(committed).toHaveBeenCalledTimes(1);
});
it("selects only the first fresh skill and repeats without writes or duplicate achievements", async () => {
  const storage = memoryStorage();
  const write = vi.spyOn(storage, "write");
  const committed = vi.fn();
  await grantStoredSkills({ available: () => true, committed }, storage);
  expect(committed.mock.calls[0]![0].progress).toMatchObject({
    activeSkill: SKILL_IDS[0],
    skills: SKILL_IDS,
  });
  const count = write.mock.calls.length;
  const again = await grantStoredSkills({ available: () => true, committed }, storage);
  expect(again).toMatchObject({ status: "unchanged", writes: [], written: [] });
  expect(write).toHaveBeenCalledTimes(count);
});
it("preserves selected Speedy's normal skill-use consequence without adding time or deaths", async () => {
  const { stats, storage, values } = fixture(true);
  await grantStoredSkills({ available: () => true, committed: vi.fn() }, storage);
  expect(JSON.parse(values.get(STATS_KEYS.save)!)).toEqual({
    ...stats,
    version: totalsFormat.version,
    wholeRun: { ...stats.wholeRun, skillUsed: true },
  });
});
it.each([PROGRESS_KEYS.save, STATS_KEYS.save, ACHIEVEMENT_KEYS.save])(
  "refuses unreadable or newer %s without writing, backing up or resetting",
  async (key) => {
    await Promise.all(
      ["broken", JSON.stringify({ version: 999999 })].map(async (raw) => {
        const { storage, values } = fixture();
        values.set(key, raw);
        const before = [...values];
        const result = await grantStoredSkills(
          { available: () => true, committed: vi.fn() },
          storage,
        );
        expect(result.status).toBe("invalid");
        expect(result.written).toEqual([]);
        expect([...values]).toEqual(before);
      }),
    );
  },
);
it("reports partial writes and retries genuine missing effects from the newly stored ownership", async () => {
  const { stats, storage, values } = fixture(true);
  const committed = vi.fn();
  const actual = storage.write;
  let failing = true;
  storage.write = async (key, value) => {
    if (failing && key === STATS_KEYS.save) {
      throw new DOMException("quota", "QuotaExceededError");
    }
    await actual(key, value);
  };
  const result = await grantStoredSkills({ available: () => true, committed }, storage);
  expect(result).toMatchObject({
    cause: "unavailable",
    record: "stats",
    status: "partial",
    writes: [
      { available: true, record: "progress", status: "saved" },
      { available: true, error: "QuotaExceededError", record: "stats", status: "unavailable" },
    ],
    written: ["progress"],
  });
  expect(committed).not.toHaveBeenCalled();
  failing = false;
  const retry = await grantStoredSkills({ available: () => true, committed }, storage);
  expect(retry).toMatchObject({ status: "saved", written: ["stats", "achievements"] });
  expect(JSON.parse(values.get(STATS_KEYS.save)!)).toMatchObject({
    wholeRun: { ...stats.wholeRun, skillUsed: true },
  });
  expect(JSON.parse(values.get(ACHIEVEMENT_KEYS.save)!)).toMatchObject({
    earned: ["escape-archie", "gift-rooms"],
  });
  expect(committed).toHaveBeenCalledTimes(1);
});
it("blocks an action invalidated during reads and rechecks availability before every write", async () => {
  const first = fixture();
  const read = first.storage.read;
  let available = true;
  first.storage.read = async (key) => {
    const value = await read(key);
    available = false;
    return value;
  };
  expect(
    await grantStoredSkills({ available: () => available, committed: vi.fn() }, first.storage),
  ).toMatchObject({ status: "blocked", written: [] });
  const next = fixture(true);
  const write = next.storage.write;
  const committed = vi.fn();
  available = true;
  next.storage.write = async (key, value) => {
    await write(key, value);
    available = false;
  };
  expect(
    await grantStoredSkills({ available: () => available, committed }, next.storage),
  ).toMatchObject({ cause: "blocked", record: "stats", status: "partial", written: ["progress"] });
  expect(committed).not.toHaveBeenCalled();
});
it("does not overwrite a record changed while the action was queued", async () => {
  const { storage, values } = fixture();
  const read = storage.read;
  let reads = 0;
  storage.read = async (key) => {
    if (++reads === 4) {
      values.set(PROGRESS_KEYS.save, "changed elsewhere");
    }
    return read(key);
  };
  expect(
    await grantStoredSkills({ available: () => true, committed: vi.fn() }, storage),
  ).toMatchObject({ reason: "record_changed", status: "blocked", written: [] });
  expect(values.get(PROGRESS_KEYS.save)).toBe("changed elsewhere");
});
