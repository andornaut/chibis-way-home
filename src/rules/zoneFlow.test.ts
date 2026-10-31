import { describe, expect, it } from "vitest";

import { DESTINATION_FIXTURE as map } from "../testing/mapDestinations";
import { introductionForRun, zoneExitFlow, zoneStoryForStage } from "./zoneFlow";

const entry = {
  character: "test-actor",
  escapeTilesPerSecond: 12,
  idleAnimation: "idle",
  offsetTiles: 6,
  runAnimation: "walk",
};
const pairs = {
  first: { entry, foreshadow: "first-foreshadow", intro: "first-intro", outro: "first-outro" },
  second: { entry, foreshadow: "second-foreshadow", intro: "second-intro", outro: "second-outro" },
};

describe("zone story routing", () => {
  it("shares the physical introduction identity across destination stages, separate from foreshadow", () => {
    const first = zoneStoryForStage(map, pairs, "one");
    const second = zoneStoryForStage(map, pairs, "two");
    expect(first).toEqual(second);
    expect(first?.intro).not.toBe(first?.foreshadow);
    expect(zoneStoryForStage(map, pairs, "debug")).toBeUndefined();
  });
  it("opens the physical introduction only on an unseen opening stage", () => {
    const story = zoneStoryForStage(map, pairs, "one");
    expect(introductionForRun(map, "one", new Set(), story)).toBe(story);
    expect(introductionForRun(map, "one", new Set(["first"]), story)).toBeUndefined();
    expect(introductionForRun(map, "two", new Set(), story)).toBeUndefined();
    expect(introductionForRun(map, "one", new Set(), undefined)).toBeUndefined();
    const missing = { ...story! };
    delete missing.entry;
    expect(() => introductionForRun(map, "one", new Set(), missing)).toThrow(
      "Missing entry introduction profile first",
    );
  });
  it.each([
    { back: false, expected: { kind: "next-stage", stage: "two" }, stage: "one" },
    {
      back: true,
      expected: { kind: "departure", scene: "first-outro", target: { kind: "map" } },
      stage: "one",
    },
    {
      back: false,
      expected: {
        kind: "departure",
        scene: "first-outro",
        target: { kind: "map", travelTo: "three" },
      },
      stage: "two",
    },
    {
      back: false,
      expected: { kind: "departure", scene: "second-outro", target: { kind: "celebration" } },
      stage: "four",
    },
  ])(
    "routes $stage exit without an outro between intermediate stages",
    ({ back, expected, stage }) => {
      const story = zoneStoryForStage(map, pairs, stage)!;
      expect(
        zoneExitFlow(map, story, new Set(["one", "two", "three", "four"]), stage, back),
      ).toEqual(expected);
    },
  );
});
