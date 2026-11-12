import { describe, expect, it } from "vitest";

import { STEP_SECONDS } from "../core/index.ts";
import { AIR_JUMP_CUE } from "../data/airJumpCue.ts";
import { BIRD } from "../data/bird.ts";
import { startBird, stepBird } from "../rules/bird.ts";
import { airJumpCue, airJumpStarted, stepAirJumpCue } from "./airJumpCue.ts";

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
    expect(airJumpCue(AIR_JUMP_CUE, frame, 0, undefined)).toEqual([]);
  });

  it("tracks the current presented frame without an independent rise and expires without an aftertail", () => {
    const launched = stepAirJumpCue(AIR_JUMP_CUE, STEP_SECONDS, before, after, undefined)!;
    const next = stepAirJumpCue(
      AIR_JUMP_CUE,
      AIR_JUMP_CUE.durationSeconds / 2,
      after,
      after,
      launched,
    )!;
    const initial = airJumpCue(AIR_JUMP_CUE, frame, 0, launched);
    const moved = airJumpCue(AIR_JUMP_CUE, { ...frame, x: 900, y: 800 }, 0, next);
    expect(moved.map(({ x, y }) => ({ x, y }))).toEqual(
      initial.map(({ x, y }) => ({ x: x + 800, y: y + 700 })),
    );
    expect(moved.every(({ alpha }) => alpha === 0.5)).toBe(true);
    expect(
      stepAirJumpCue(AIR_JUMP_CUE, AIR_JUMP_CUE.durationSeconds, after, after, next),
    ).toBeUndefined();
    expect(
      stepAirJumpCue(AIR_JUMP_CUE, 0, after, { ...after, grounded: true }, next),
    ).toBeUndefined();
  });

  it.each([-100, 0, 100])("leads only the actual horizontal velocity %s", (vx) => {
    const cue = { elapsedSeconds: 0 };
    const still = airJumpCue(AIR_JUMP_CUE, frame, 0, cue);
    const moving = airJumpCue(AIR_JUMP_CUE, frame, vx, cue);
    expect(moving.map(({ x, y }) => ({ x, y }))).toEqual(
      still.map(({ x, y }) => ({
        x: x + Math.sign(vx) * AIR_JUMP_CUE.forwardLead,
        y,
      })),
    );
  });

  it.each([
    { fraction: 0, id: "integer frame" },
    { fraction: 0.25, id: "lower fractional frame" },
    { fraction: 0.75, id: "upper fractional frame" },
  ])("keeps integer pixels, a fixed keyline and a full-frame gap at $id", ({ fraction }) => {
    const current = {
      ...frame,
      x: frame.x + fraction,
      y: frame.y + fraction,
    };
    const pixels = airJumpCue(AIR_JUMP_CUE, current, 0, {
      elapsedSeconds: 0,
    });
    expect(pixels).toEqual(
      airJumpCue(AIR_JUMP_CUE, frame, 0, { elapsedSeconds: 0 }).map((pixel) => ({
        ...pixel,
        x: pixel.x + Math.round(fraction),
        y: pixel.y + Math.round(fraction),
      })),
    );
    const core = pixels.filter(({ colour }) => colour === AIR_JUMP_CUE.colour);
    const bounds = (points: typeof pixels) => ({
      bottom: Math.max(...points.map(({ y }) => y)) + 1,
      left: Math.min(...points.map(({ x }) => x)),
      right: Math.max(...points.map(({ x }) => x)) + 1,
      top: Math.min(...points.map(({ y }) => y)),
    });
    const outer = bounds(pixels);
    const inner = bounds(core);
    expect(
      pixels.every(
        ({ height, width, x, y }) =>
          Number.isInteger(x) && Number.isInteger(y) && width === 1 && height === 1,
      ),
    ).toBe(true);
    expect({
      height: outer.bottom - outer.top,
      width: outer.right - outer.left,
    }).toEqual({
      height: 22,
      width: 17,
    });
    expect(outer).toEqual({
      bottom: inner.bottom + 1,
      left: inner.left - 1,
      right: inner.right + 1,
      top: inner.top - 1,
    });
    expect(outer.top - Math.round(current.y + current.height)).toBe(1);
  });

  it("draws two open upward carets close beneath the full frame with an unscaled keyline", () => {
    const pixels = airJumpCue(AIR_JUMP_CUE, frame, 0, { elapsedSeconds: 0 });
    const cores = pixels.filter(({ colour }) => colour === AIR_JUMP_CUE.colour);
    const border = pixels.filter(({ colour }) => colour === AIR_JUMP_CUE.borderColour);
    expect(cores.length).toBeGreaterThan(0);
    expect(border.length).toBeGreaterThan(0);
    expect(new Set(pixels.map(({ x, y }) => `${x},${y}`)).size).toBe(pixels.length);
    expect(pixels.slice(0, border.length)).toEqual(border);
    const centre = {
      x: frame.x + frame.width / 2 + AIR_JUMP_CUE.offset.x,
      y: frame.y + frame.height / 2 + AIR_JUMP_CUE.offset.y,
    };
    const hasCore = (x: number, y: number) => cores.some((at) => at.x === x && at.y === y);
    for (const top of [2, 9]) {
      expect(hasCore(centre.x, centre.y + Math.round((top - 8) * AIR_JUMP_CUE.scale))).toBe(true);
      expect(hasCore(centre.x, centre.y + Math.round((top - 8 + 4) * AIR_JUMP_CUE.scale))).toBe(
        false,
      );
    }
    const gap = Math.min(...pixels.map(({ y }) => y)) - frame.y - frame.height;
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(2);
    expect(Math.min(...border.map(({ x }) => x))).toBe(
      Math.min(...cores.map(({ x }) => x)) - AIR_JUMP_CUE.borderThickness,
    );
  });
});
