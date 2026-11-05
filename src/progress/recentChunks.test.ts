import { encodeSave, loadSave } from "@andornaut/game-kit/save/versionedSave";
import { describe, expect, it } from "vitest";

import { ZONE_MAP } from "../data/map";
import { RECENT_STAGES } from "../data/stageProgress";
import type { ZonePlan } from "../data/types";
import { RECIPES } from "../data/zones";
import { middleChunkIds, recentMiddleChunks, withRecentMiddleChunks } from "./recentChunks";
import { BEGINNING, type Progress, PROGRESS_VERSION, progressFormat } from "./save/progress";

const ZONE = ZONE_MAP.destinations[0]!.id;
const OTHER = ZONE_MAP.destinations[1]!.id;
const AT_MAP: Progress = {
  activeSkill: null,
  at: "map",
  completed: [],
  openingSeen: true,
  seenZoneIntros: [],
  skills: [],
  stand: ZONE_MAP.start,
};
const FORMAT = progressFormat(ZONE_MAP, RECIPES, new Set(["a", "b", "c", "d"]));
const stored = (recent: unknown) =>
  JSON.stringify({ ...AT_MAP, recent, version: PROGRESS_VERSION });

describe("recent middle chunks", () => {
  it("keeps the zone's last two stage entries, newest first, apart from other zones", () => {
    const recorded = [["a", "b"], ["c"], ["d", "a"]].reduce(
      (progress, middle) => withRecentMiddleChunks(ZONE, middle, progress),
      withRecentMiddleChunks(OTHER, ["b"], AT_MAP),
    );
    expect({
      other: recentMiddleChunks(recorded, OTHER),
      recent: recorded.at === "map" ? recorded.recent?.[ZONE] : undefined,
      window: RECENT_STAGES,
      zone: recentMiddleChunks(recorded, ZONE),
    }).toEqual({ other: ["b"], recent: [["d", "a"], ["c"]], window: 2, zone: ["d", "a", "c"] });
  });

  it("is empty by default and at the beginning, where nothing is recorded", () => {
    expect([
      recentMiddleChunks(AT_MAP, ZONE),
      recentMiddleChunks(BEGINNING, ZONE),
      withRecentMiddleChunks(ZONE, ["a"], BEGINNING),
    ]).toEqual([[], [], BEGINNING]);
  });

  it("drops unknown chunk ids on load and keeps the known ones", () => {
    const loaded = loadSave(FORMAT, stored({ [ZONE]: [["a", "gone"], ["b"]] }));
    expect({ save: loaded.save, status: loaded.status }).toEqual({
      save: { ...AT_MAP, recent: { [ZONE]: [["a"], ["b"]] } },
      status: "loaded",
    });
  });

  it.each([
    ["an unknown zone", { nowhere: [["a"]] }],
    ["more entries than the window", { [ZONE]: [["a"], ["b"], ["c"]] }],
    ["an entry that is not a list of ids", { [ZONE]: ["a"] }],
    ["a list in place of a record", [["a"]]],
  ])("treats %s as a malformed save", (_, recent) => {
    expect(loadSave(FORMAT, stored(recent)).status).not.toBe("loaded");
  });

  it("writes no field until an entry is recorded, then round-trips it", () => {
    const recorded = withRecentMiddleChunks(ZONE, ["c"], AT_MAP);
    const plain = encodeSave(FORMAT, AT_MAP);
    const encoded = encodeSave(FORMAT, recorded);
    expect({
      plain: plain.ok && "recent" in (JSON.parse(plain.value) as object),
      reopened: encoded.ok && loadSave(FORMAT, encoded.value).save,
    }).toEqual({ plain: false, reopened: recorded });
  });

  it("takes each area's chunks but its first and last as the middle", () => {
    const placed = (ids: string[]) => ids.map((chunk, col) => ({ chunk, col, cols: 1 }));
    const plan = {
      areaOrder: ["lower", "upper"],
      areas: {
        lower: { chunks: placed(["start", "a", "b", "finish"]) },
        upper: { chunks: placed(["cap", "b", "c", "cap"]) },
      },
    } as unknown as ZonePlan;
    expect(middleChunkIds(plan)).toEqual(["a", "b", "c"]);
  });
});
