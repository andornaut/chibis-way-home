import { encodeSave, loadSave } from "@andornaut/game-kit/save/versionedSave";
import { describe, expect, it } from "vitest";

import { ZONE_MAP } from "../data/map";
import type { MapNode, ZoneMap } from "../data/types";
import { RECIPES, ZONES } from "../data/zones";
import { openMap } from "../rules/map";
import { destinationForStage, destinationSelection } from "../rules/mapDestinations";
import { BEGINNING, type Progress, PROGRESS_VERSION, progressFormat } from "./progress";

const node = (id: string, kind: MapNode["kind"], zone?: string): MapNode => ({
  at: { col: 0, row: 0 },
  id,
  kind,
  ...(zone === undefined ? {} : { zone }),
});

// A start zone, a fork to a built zone and an unbuilt one, a built path to a zone node whose zone
// is gone, and the finish.
const MAP: ZoneMap = {
  decorations: [],
  destinations: [
    { at: { col: 0, row: 0 }, icon: "zone", id: "test-zone", stages: ["start", "built"] },
  ],
  edges: [
    { built: true, from: "start", to: "fork" },
    { built: true, from: "fork", to: "built" },
    { built: false, from: "fork", to: "unbuilt" },
    { built: true, from: "start", to: "gone" },
    { built: true, from: "built", to: "finish" },
  ],
  finish: "finish",
  nodes: [
    node("start", "zone", "start"),
    node("fork", "fork"),
    node("built", "zone", "built"),
    node("unbuilt", "zone", "unbuilt"),
    node("gone", "zone", "removed"),
    node("finish", "fork"),
  ],
  start: "start",
};
const ZONE_KEYS = { built: {}, start: {}, unbuilt: {} };
const FORMAT = progressFormat(MAP, ZONE_KEYS);

const stored = (fields: object, version = PROGRESS_VERSION) =>
  JSON.stringify({ openingSeen: false, seenZoneIntros: [], ...fields, version });
const at = (stand: string, completed: string[] = []): Progress => ({
  at: "map",
  completed,
  openingSeen: false,
  seenZoneIntros: [],
  stand,
});

describe("progressFormat", () => {
  it.each<[string, Progress]>([
    ["the beginning", BEGINNING],
    ["acknowledged beginning", { ...BEGINNING, openingSeen: true }],
    [
      "a remembered zone introduction",
      { ...at("start"), seenZoneIntros: ["test-zone"] } as Progress,
    ],
    ["the first zone, nothing completed", at("start")],
    ["a zone past the fork, the first completed", at("built", ["start"])],
    ["back on the first zone, both completed", at("start", ["start", "built"])],
  ])("round-trips %s", (_, progress) => {
    const encoded = encodeSave(FORMAT, progress);
    expect(encoded.ok && loadSave(FORMAT, encoded.value)).toEqual({
      save: progress,
      status: "loaded",
    });
  });

  it.each([
    ["missing opening acknowledgement", stored({ at: "beginning", openingSeen: undefined })],
    ["invalid opening acknowledgement", stored({ at: "beginning", openingSeen: "yes" })],
    [
      "missing introduction list",
      stored({ at: "map", completed: [], seenZoneIntros: undefined, stand: "start" }),
    ],
    [
      "unknown introduction",
      stored({ at: "map", completed: [], seenZoneIntros: ["unknown"], stand: "start" }),
    ],
    [
      "duplicate introduction",
      stored({
        at: "map",
        completed: [],
        seenZoneIntros: ["test-zone", "test-zone"],
        stand: "start",
      }),
    ],
    ["not JSON", "{not json"],
    ["no version", JSON.stringify({ at: "map", completed: [], stand: "start" })],
    ["version 1", stored({ at: "map", route: ["start"] }, 1)],
    ["version 2", stored({ at: "map", route: ["start"], seed: 7 }, 2)],
    [
      "the previous catalogue version",
      stored({ at: "map", completed: [], stand: "start" }, PROGRESS_VERSION - 1),
    ],
    ["an unknown place", stored({ at: "shop", completed: [], stand: "start" })],
    [
      "completed zones that are not a list",
      stored({ at: "map", completed: "start", stand: "start" }),
    ],
    ["a completed zone that is not a name", stored({ at: "map", completed: [3], stand: "start" })],
    ["no stand", stored({ at: "map", completed: [] })],
    ["a stand not yet open", stored({ at: "map", completed: [], stand: "built" })],
    ["a stand on a fork", stored({ at: "map", completed: ["start"], stand: "fork" })],
    ["a stand on a path not built", stored({ at: "map", completed: ["start"], stand: "unbuilt" })],
    ["a stand that no longer exists", stored({ at: "map", completed: [], stand: "moved" })],
    ["a zone that no longer exists", stored({ at: "map", completed: ["start"], stand: "gone" })],
    ["a completed zone not open", stored({ at: "map", completed: ["built"], stand: "start" })],
    [
      "a completed zone named twice",
      stored({ at: "map", completed: ["start", "start"], stand: "start" }),
    ],
  ])("starts from the beginning on a save with %s", (_, raw) => {
    expect(loadSave(FORMAT, raw)).toMatchObject({ save: BEGINNING, status: "corrupt" });
  });

  it("leaves a later version's save alone and starts from the beginning", () => {
    const raw = stored({ at: "map", completed: [], stand: "start" }, PROGRESS_VERSION + 1);
    expect(loadSave(FORMAT, raw)).toMatchObject({ save: BEGINNING, status: "newer" });
  });

  it("refuses to store a stand that is not open", () => {
    expect(encodeSave(FORMAT, at("built")).ok).toBe(false);
  });

  it("takes the game's map start, nothing completed, as a place to stand", () => {
    expect(
      encodeSave(progressFormat(ZONE_MAP, { ...ZONES, ...RECIPES }), at(ZONE_MAP.start)).ok,
    ).toBe(true);
  });
});

describe("built cityscape progress", () => {
  const plans = { ...ZONES, ...RECIPES };
  const format = progressFormat(ZONE_MAP, plans);

  const stages = ZONE_MAP.destinations[0]!.stages;
  it.each([
    { completed: stages.slice(0, 1), stand: stages[0], unlocked: stages.slice(0, 2) },
    { completed: stages.slice(0, -1), stand: stages.at(-1)!, unlocked: stages },
    { completed: stages, stand: stages[0], unlocked: stages },
  ])(
    "keeps current-format progress at $stand with $completed completed",
    ({ completed, stand, unlocked }) => {
      const progress = {
        at: "map" as const,
        completed,
        openingSeen: true,
        seenZoneIntros: [],
        stand,
      };
      const loaded = loadSave(format, JSON.stringify({ ...progress, version: PROGRESS_VERSION }));
      expect(loaded).toEqual({ save: progress, status: "loaded" });
      const encoded = encodeSave(format, loaded.save);
      expect(encoded.ok).toBe(true);
      if (!encoded.ok) {
        throw new Error("Expected valid cityscape progress");
      }
      const reopened = loadSave(format, encoded.value);
      expect(reopened).toEqual(loaded);
      if (reopened.save.at !== "map") {
        throw new Error("Expected saved map progress");
      }
      expect(
        destinationSelection(
          new Set(Object.keys(plans)),
          ZONE_MAP,
          openMap(ZONE_MAP, new Set(reopened.save.completed)),
          destinationForStage(ZONE_MAP, reopened.save.stand),
        ),
      ).toEqual({ kind: "choose", latest: unlocked.at(-1), stages: unlocked });
    },
  );
});
