import { describe, expect, it } from "vitest";

import { DESTINATION_FIXTURE as map } from "../testing/mapDestinations";
import { foreshadowForRun, zoneExitFlow, zoneStoryForStage } from "./zoneFlow";

const pairs = {
  first: { foreshadow: "first-foreshadow", intro: "first-intro", outro: "first-outro" },
  second: { foreshadow: "second-foreshadow", intro: "second-intro", outro: "second-outro" },
};

describe("zone story routing", () => {
  it("shares the physical introduction identity across destination stages, separate from foreshadow", () => {
    const first = zoneStoryForStage(map, pairs, "one");
    const second = zoneStoryForStage(map, pairs, "two");
    expect(first).toEqual(second);
    expect(first?.intro).not.toBe(first?.foreshadow);
    expect(zoneStoryForStage(map, pairs, "debug")).toBeUndefined();
  });
  it("repeats live foreshadow on a fresh opening-stage run but not its retry", () => {
    const story = zoneStoryForStage(map, pairs, "one");
    expect(foreshadowForRun(map, "one", false, story)).toBe(pairs.first.foreshadow);
    expect(foreshadowForRun(map, "one", true, story)).toBeUndefined();
    expect(foreshadowForRun(map, "one", false, story)).toBe(pairs.first.foreshadow);
    expect(foreshadowForRun(map, "two", false, story)).toBeUndefined();
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
