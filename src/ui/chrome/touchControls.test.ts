import type { AnimationFrame } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import type { HeldTouch } from "../input/intent";
import { buttonHeld, centredAt, controlTag, trackPress } from "./touchControls";

const JUMP: HeldTouch = { role: "jump", startX: 600, startY: 200, x: 600 };
const MOVE: HeldTouch = { role: "move", startX: 100, startY: 200, x: 140 };

describe("buttonHeld", () => {
  it.each([
    ["jump", [], false],
    ["jump", [JUMP], true],
    ["use", [JUMP, MOVE], false],
  ] as const)("holds %s with %j: %s", (control, touches, held) => {
    expect(buttonHeld(control, touches)).toBe(held);
  });
});

describe("trackPress", () => {
  it.each([
    [false, undefined, undefined],
    [false, 100, undefined],
    [true, undefined, 500],
    [true, 100, 100],
  ])("held %s since %j tracks as %j", (held, sinceMs, tracked) => {
    expect(trackPress(500, held, sinceMs)).toBe(tracked);
  });
});

describe("controlTag", () => {
  const frames = (...ms: number[]): AnimationFrame[] =>
    ms.map((duration) => ({ duration, frame: "" }));
  const tags = new Map([["press", frames(60, 60)]]);
  it.each([
    [0, undefined, "rest"],
    [1000, 1000, "press"],
    [1119, 1000, "press"],
    [1120, 1000, "held"],
  ])("at %i ms, pressed since %j, shows %s", (nowMs, sinceMs, tag) => {
    expect(controlTag(tags, nowMs, sinceMs)).toBe(tag);
  });
});

describe("centredAt", () => {
  it("centres a non-square frame on its centre pixel", () => {
    expect(centredAt({ x: 100, y: 200 }, { height: 67, width: 77 })).toEqual({ x: 62, y: 167 });
  });
});
