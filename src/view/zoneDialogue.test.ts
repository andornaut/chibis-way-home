import { describe, expect, it } from "vitest";

import type { ObjectLayout } from "../data/types";
import { TEST_PURSUER } from "../testing/behaviours";
import { proximityDialogue } from "./zoneDialogue";

const OBJECT = {
  behaviour: TEST_PURSUER,
  height: 48,
  interaction: { kind: "talk", range: 100 },
  scene: "intro",
  width: 60,
} as ObjectLayout;
const ORDINARY = { ...OBJECT };
delete ORDINARY.behaviour;
const BIRD = { height: 36, width: 24, x: 0, y: 0 };
// Both centres at y18; the first centre is exactly100px away along x.
const NEAR = { x: 82, y: -6 };

describe("proximityDialogue", () => {
  it.each([
    ["at the interaction limit", [OBJECT], [NEAR], new Set<number>(), 0],
    [
      "outside the interaction range",
      [OBJECT],
      [{ ...NEAR, x: NEAR.x + 1 }],
      new Set<number>(),
      undefined,
    ],
    ["already heard this attempt", [OBJECT], [NEAR], new Set([0]), undefined],
    ["heard set cleared for another attempt", [OBJECT], [NEAR], new Set<number>(), 0],
    ["ordinary harmless character", [ORDINARY], [NEAR], new Set<number>(), undefined],
    [
      "no scene configured",
      [{ ...OBJECT, scene: undefined }],
      [NEAR],
      new Set<number>(),
      undefined,
    ],
  ] as const)("selects the correct introduction: %s", (_, objects, positions, heard, expected) => {
    expect(proximityDialogue(objects, positions, heard, BIRD)).toBe(expected);
  });
});
