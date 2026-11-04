import { seededRandom } from "@andornaut/game-kit/random";
import { describe, expect, it } from "vitest";

import type { ObjectLayout } from "../data/types";
import { characterState, nextQuirkAt } from "./character";

const avoider = { reaction: { kind: "avoid", range: 50, speed: 1 } } as ObjectLayout;
const calm = { reaction: { kind: "none", range: 0, speed: 0 } } as ObjectLayout;
const at = { x: 0, y: 0 };

describe("characterState", () => {
  it.each([
    ["a reacting character with him in range", avoider, false, { x: 30, y: 40 }, "react"],
    ["a reacting character with him out of range", avoider, true, { x: 60, y: 0 }, "move"],
    ["a character that moved", calm, true, { x: 10, y: 0 }, "move"],
    ["a character standing still", calm, false, { x: 10, y: 0 }, "idle"],
  ] as const)("shows %s as %s", (_, object, moved, hers, state) => {
    expect(characterState(object, moved, at, hers)).toBe(state);
  });
});

describe("nextQuirkAt", () => {
  it.each([0, 0.25, 1])("schedules a quirk within its variance (%f) of every", (variance) => {
    const random = seededRandom(9);
    const times = Array.from({ length: 50 }, () =>
      nextQuirkAt(random, { every: 4, tag: "t", variance }, 10),
    );
    expect(Math.min(...times)).toBeGreaterThanOrEqual(10 + 4 * (1 - variance));
    expect(Math.max(...times)).toBeLessThanOrEqual(10 + 4 * (1 + variance));
  });
});
