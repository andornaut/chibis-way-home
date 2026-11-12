import { expect, it } from "vitest";

import { BOSS_WARNING } from "../data/bossWarning.ts";
import type { PixelRun, SpriteContact } from "../data/types/index.ts";
import { bossWarning } from "./bossWarning.ts";

const tuning = BOSS_WARNING;
const tell = { active: true, activeAttack: { id: "attack", phase: "tell" as const } };
const contact: SpriteContact = {
  frame: { height: 5, width: 5 },
  frames: {
    first: [
      [1, 1, 2],
      [2, 1, 3],
      [4, 4, 5],
    ],
    ring: [
      [0, 0, 5],
      [1, 0, 1],
      [1, 4, 5],
      [2, 0, 1],
      [2, 4, 5],
      [3, 0, 1],
      [3, 4, 5],
      [4, 0, 5],
    ],
    second: [[0, 0, 1]],
  },
  tags: {},
};
function pixels(runs: readonly PixelRun[]) {
  return new Set(
    runs.flatMap(([y, left, right]) =>
      Array.from({ length: right - left }, (_, x) => `${left + x},${y}`),
    ),
  );
}

it("follows irregular animated alpha including detached pixels, without painting the body", () => {
  const original = JSON.stringify(contact);
  const first = bossWarning(tuning, tell, contact, "first")!;
  const red = pixels(first.red);
  const ink = pixels(first.ink);
  expect(red.has("0,1")).toBe(true);
  expect(ink.has("-1,1")).toBe(true);
  expect(red.has("5,4")).toBe(true);
  expect(red.has("1,1")).toBe(false);
  expect(ink.has("1,1")).toBe(false);
  expect([...ink].some((pixel) => red.has(pixel))).toBe(false);
  const second = bossWarning(tuning, tell, contact, "second")!;
  expect(pixels(second.red).has("5,4")).toBe(false);
  expect(bossWarning(tuning, tell, contact, "first")).toBe(first);
  expect(second).not.toBe(first);
  expect(JSON.stringify(contact)).toBe(original);
  expect(pixels(bossWarning(tuning, tell, contact, "ring")!.red).has("2,2")).toBe(false);
});

it("only outlines active tells and keys cached geometry by the pixel widths", () => {
  for (const state of [
    undefined,
    { active: false, activeAttack: tell.activeAttack },
    { active: true },
    { active: true, activeAttack: { id: "attack", phase: "committed" as const } },
  ]) {
    expect(bossWarning(tuning, state, contact, "first")).toBeUndefined();
  }
  expect(bossWarning(tuning, tell, undefined, "first")).toBeUndefined();
  const wide = bossWarning(
    { ...tuning, strokeWidth: tuning.strokeWidth + 1 },
    tell,
    contact,
    "first",
  )!;
  expect(pixels(wide.red).has("-1,1")).toBe(true);
  expect(() => bossWarning(tuning, tell, contact, "missing")).toThrow("Missing warning silhouette");
});

it("shows the same actual-alpha warning during traversal takeoff preparation without an active attack", () => {
  const state = {
    active: true,
    traversal: {
      geometry: "",
      inputs: [],
      physical: { fallFromY: 10, grounded: true, vy: 0, x: 0, y: 0 },
      preparation: { move: 1 as const, remainingSeconds: 0.6, startedAtSeconds: 0 },
      status: "found" as const,
      target: { height: 10, width: 10, x: 20, y: 0 },
    },
  };
  expect(bossWarning(tuning, state, contact, "first")).toBe(
    bossWarning(tuning, tell, contact, "first"),
  );
  expect(bossWarning(tuning, { ...state, active: false }, contact, "first")).toBeUndefined();
});
