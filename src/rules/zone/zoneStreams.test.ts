import { describe, expect, it } from "vitest";

import { zoneDecisionStreams, zoneStream, type ZoneStreamPurpose } from "./zoneStreams.ts";

const DRAWS = 4;
const GRID = [0, 1, 2, 3];
const PURPOSES: readonly ZoneStreamPurpose[] = ["idle-roam", "motion", "quirk"];

const firstDraws = (seed: number, attempt: number, purpose: ZoneStreamPurpose): string => {
  const random =
    purpose === "idle-roam"
      ? zoneDecisionStreams({ attempt, seed }, "main", 0)("move:0")
      : zoneStream({ attempt, seed }, purpose, "main", 0);
  return JSON.stringify(Array.from({ length: DRAWS }, random));
};

describe("zone streams", () => {
  it.each(PURPOSES)("gives every seed and attempt pair its own %s draws", (purpose) => {
    const draws = GRID.flatMap((seed) => GRID.map((attempt) => firstDraws(seed, attempt, purpose)));
    expect(new Set(draws).size).toBe(GRID.length * GRID.length);
  });

  it.each(PURPOSES)("draws seed 1's retry apart from seed 2's first %s attempt", (purpose) => {
    expect(firstDraws(1, 1, purpose)).not.toBe(firstDraws(2, 0, purpose));
  });

  it("replays equal draws for an equal seed and attempt", () => {
    expect(firstDraws(1, 1, "motion")).toBe(firstDraws(1, 1, "motion"));
  });
});
