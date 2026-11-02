import { describe, expect, it } from "vitest";

import { AIR_JUMP_CUE } from "../data/airJumpCue";
import { BIRD } from "../data/bird";
import { startBird, stepBird } from "../rules/bird";
import { STEP_SECONDS } from "../rules/step";
import { airJumpCue, airJumpStarted, stepAirJumpCue } from "./airJumpCue";

const frame = { height: 42, width: 48, x: 100, y: 100 };
const before = startBird(BIRD, { x: 124, y: 142 });
const jump = { jumpHeld: true, move: 0 } as const;
const after = stepBird(BIRD, [], [], STEP_SECONDS, jump, before);

describe("second-jump cue", () => {
  it("uses the accepted physics transition, excluding ordinary, held and refused jumps", () => {
    expect(airJumpStarted(before, after)).toBe(true);
    const held = stepBird(BIRD, [], [], STEP_SECONDS, jump, after);
    expect(airJumpStarted(after, held)).toBe(false);
    const released = stepBird(BIRD, [], [], STEP_SECONDS, { ...jump, jumpHeld: false }, held);
    const refused = stepBird(BIRD, [], [], STEP_SECONDS, jump, released);
    expect(airJumpStarted(released, refused)).toBe(false);
    const ordinary = stepBird(
      BIRD,
      [{ height: 20, width: 200, x: 0, y: before.y + BIRD.height }],
      [],
      STEP_SECONDS,
      jump,
      before,
    );
    expect(airJumpStarted(before, ordinary)).toBe(false);
    expect(airJumpCue(AIR_JUMP_CUE, undefined)).toEqual([]);
  });

  it("keeps launch coordinates as Chibi moves away and expires without an aftertail", () => {
    const launched = stepAirJumpCue(AIR_JUMP_CUE, STEP_SECONDS, frame, before, after, undefined)!;
    const next = stepAirJumpCue(
      AIR_JUMP_CUE,
      AIR_JUMP_CUE.durationSeconds / 2,
      { ...frame, x: 900 },
      after,
      { ...after, x: 900 },
      launched,
    )!;
    expect(next.origin).toEqual(launched.origin);
    expect(airJumpCue(AIR_JUMP_CUE, next).every(({ alpha }) => alpha === 0.5)).toBe(true);
    expect(
      stepAirJumpCue(AIR_JUMP_CUE, AIR_JUMP_CUE.durationSeconds, frame, after, after, next),
    ).toBeUndefined();
    expect(
      stepAirJumpCue(AIR_JUMP_CUE, 0, frame, after, { ...after, grounded: true }, next),
    ).toBeUndefined();
  });

  it("draws two open upward carets with an unscaled keyline, not horizontal wind lines", () => {
    const cue = stepAirJumpCue(AIR_JUMP_CUE, STEP_SECONDS, frame, before, after, undefined)!;
    const pixels = airJumpCue(AIR_JUMP_CUE, cue);
    const cores = pixels.filter(({ colour }) => colour === AIR_JUMP_CUE.colour);
    const border = pixels.filter(({ colour }) => colour === AIR_JUMP_CUE.borderColour);
    expect(cores.length).toBeGreaterThan(0);
    expect(border.length).toBeGreaterThan(0);
    expect(new Set(pixels.map(({ x, y }) => `${x},${y}`)).size).toBe(pixels.length);
    expect(pixels.slice(0, border.length)).toEqual(border);
    const centre = {
      x: cue.origin.x + AIR_JUMP_CUE.offset.x,
      y: cue.origin.y + AIR_JUMP_CUE.offset.y,
    };
    const hasCore = (x: number, y: number) => cores.some((at) => at.x === x && at.y === y);
    for (const top of [2, 9]) {
      expect(hasCore(centre.x, centre.y + (top - 8) * AIR_JUMP_CUE.scale)).toBe(true);
      expect(hasCore(centre.x, centre.y + (top - 8 + 4) * AIR_JUMP_CUE.scale)).toBe(false);
    }
    expect(Math.min(...border.map(({ x }) => x))).toBe(
      Math.min(...cores.map(({ x }) => x)) - AIR_JUMP_CUE.borderThickness,
    );
  });
});
