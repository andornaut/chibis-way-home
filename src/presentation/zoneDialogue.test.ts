import { describe, expect, it } from "vitest";

import type { ObjectLayout } from "../data/types/index.ts";
import { TEST_PURSUER } from "../testing/behaviours.ts";
import { barkOwnerOnscreen, proximityDialogue } from "./zoneDialogue.ts";

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

const OWNER = { area: "main", attempt: 2, objectIndex: 4 };
const VIEW = { height: 360, width: 720, x: 100, y: 200 };
const POSE = { bounds: { height: 60, width: 48, x: 110, y: 210 }, rendered: true };

describe("bark owner rendering", () => {
  it.each([
    { name: "current rendered owner", owner: OWNER, pose: POSE, visible: true },
    { name: "stale area", owner: { ...OWNER, area: "old" }, pose: POSE, visible: false },
    { name: "stale attempt", owner: { ...OWNER, attempt: 1 }, pose: POSE, visible: false },
    {
      name: "missing source index",
      owner: { ...OWNER, objectIndex: 9 },
      pose: POSE,
      visible: false,
    },
    {
      name: "actor excluded by renderer",
      owner: OWNER,
      pose: { ...POSE, rendered: false },
      visible: false,
    },
    {
      name: "current pose outside camera",
      owner: OWNER,
      pose: { ...POSE, bounds: { ...POSE.bounds, x: 900 } },
      visible: false,
    },
    { name: "unowned voice", owner: undefined, pose: POSE, visible: false },
  ])("presents $name only when its source is actually onscreen", ({ owner, pose, visible }) => {
    const poses = new Map([[4, pose]]);
    expect(
      barkOwnerOnscreen(
        { area: "main", attempt: 2, view: VIEW },
        (index) => poses.get(index),
        owner,
      ),
    ).toBe(visible);
  });
});
