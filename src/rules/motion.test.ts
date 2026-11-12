import { seededRandom } from "@andornaut/game-kit/random";
import { describe, expect, it } from "vitest";

import type { Motion } from "../data/types/index.ts";
import { axisOf, motionTrack } from "./motion.ts";

// 100 px right at 50 px/s: 2 s each way, with 1 s pauses, a 6 s round trip.
const LINEAR: Motion = {
  algorithm: "linear",
  direction: "right",
  distance: 100,
  hopHeight: 0,
  pause: 1,
  speed: 50,
  variance: 0,
};
const random = () => seededRandom(7);

describe("motionTrack", () => {
  it.each([
    ["static", { ...LINEAR, algorithm: "static" }, 0, 1, { x: 0, y: 0 }],
    ["linear, setting off", LINEAR, 0, 0, { x: 0, y: 0 }],
    ["linear, halfway out", LINEAR, 0, 1, { x: 50, y: 0 }],
    ["linear, pausing at the far end", LINEAR, 0, 2.5, { x: 100, y: 0 }],
    ["linear, halfway back", LINEAR, 0, 4, { x: 50, y: 0 }],
    ["linear, a round trip later", LINEAR, 0, 7, { x: 50, y: 0 }],
    ["linear from phase 0.5, at the far end", LINEAR, 0.5, 0, { x: 100, y: 0 }],
    ["linear, moving up", { ...LINEAR, direction: "up" }, 0, 1, { x: 0, y: -50 }],
    ["linear, moving left", { ...LINEAR, direction: "left" }, 0, 1, { x: -50, y: 0 }],
    [
      "ease, a quarter of the way out in time",
      { ...LINEAR, algorithm: "ease" },
      0,
      0.5,
      { x: 14.6447, y: 0 },
    ],
    [
      "hop, at the top of its arc",
      { ...LINEAR, algorithm: "hop", hopHeight: 20 },
      0,
      1,
      { x: 50, y: -20 },
    ],
    [
      "hop, landed at the far end",
      { ...LINEAR, algorithm: "hop", hopHeight: 20 },
      0,
      2,
      { x: 100, y: 0 },
    ],
    ["with no speed", { ...LINEAR, speed: 0 }, 0, 1, { x: 0, y: 0 }],
  ] as const)("is %s", (_, motion, phase, seconds, at) => {
    const point = motionTrack(motion, phase, random()).at(seconds);
    expect(point.x).toBeCloseTo(at.x, 3);
    expect(point.y).toBeCloseTo(at.y, 3);
  });

  const WANDER: Motion = { ...LINEAR, algorithm: "wander" };
  const VARIED: Motion = { ...LINEAR, variance: 0.5 };

  it("draws random legs only as time reaches them, including zero-travel legs", () => {
    let draws = 0;
    const track = motionTrack(
      { ...LINEAR, algorithm: "hop", hopHeight: 20, variance: 1 },
      0,
      () => {
        draws += 1;
        return draws === 1 ? 0 : 0.5;
      },
    );
    expect(draws).toBe(0);
    expect(track.at(0)).toEqual({ x: 0, y: 0 });
    expect(draws).toBe(3);
    expect(track.at(0.5)).toEqual({ x: 0, y: 0 });
    expect(track.at(0)).toEqual({ x: 0, y: 0 });
    expect(draws).toBe(3);
    track.at(1);
    expect(draws).toBe(5);
  });

  it("keeps the hop parabola local to each leg and stays grounded during pauses", () => {
    const track = motionTrack({ ...LINEAR, algorithm: "hop", hopHeight: 20 }, 0.5, random());
    expect(track.at(0.5)).toEqual({ x: 75, y: -15 });
    expect(track.at(2)).toEqual({ x: 0, y: 0 });
    expect(track.at(2.75)).toEqual({ x: 0, y: 0 });
  });

  it.each([
    ["wander", WANDER],
    ["varied linear", VARIED],
  ])("draws the same %s track from the same seed, asked in any order", (_, motion) => {
    const times = [0.5, 3, 9, 20, 41];
    const forward = motionTrack(motion, 0, seededRandom(3));
    const backward = motionTrack(motion, 0, seededRandom(3));
    const there = times.map((time) => forward.at(time));
    const back = [...times]
      .reverse()
      .map((time) => backward.at(time))
      .reverse();
    expect(back).toEqual(there);
  });

  it.each([
    ["wander", WANDER],
    ["varied linear", VARIED],
  ])("draws a different %s track from another seed", (_, motion) => {
    const times = [3, 9, 20, 41];
    const one = times.map((time) => motionTrack(motion, 0, seededRandom(3)).at(time));
    const other = times.map((time) => motionTrack(motion, 0, seededRandom(4)).at(time));
    expect(other).not.toEqual(one);
  });

  it("wanders only between the placed spot and the far end", () => {
    const track = motionTrack(WANDER, 0, seededRandom(11));
    const xs = Array.from({ length: 400 }, (_, step) => track.at(step / 4).x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(WANDER.distance);
  });

  it.each([0.5, 0, 1])("varies each leg's length by at most the variance (%f)", (variance) => {
    const track = motionTrack({ ...LINEAR, variance }, 0, seededRandom(5));
    const xs = Array.from({ length: 600 }, (_, step) => track.at(step / 10).x);
    expect(Math.max(...xs)).toBeLessThanOrEqual(LINEAR.distance * (1 + variance) + 1e-9);
  });
});

describe("axisOf", () => {
  it("points down along the vertical axis", () => {
    expect(axisOf("down")).toEqual({ x: 0, y: 1 });
  });
});
