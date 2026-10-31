import { describe, expect, it } from "vitest";

import { type ForcePulse, forcePulseVelocity, forcePulseVolume } from "./force";

const pulse: ForcePulse = {
  facing: 1,
  height: 40,
  range: 100,
  remaining: 1,
  source: { height: 40, width: 20, x: 0, y: 20 },
  start: 0,
  velocity: { x: 120, y: 0 },
};
const target = { height: 20, width: 10, x: 60, y: 30 };
const wall = { height: 40, width: 10, x: 30, y: 20 };

describe("finite force pulses", () => {
  it.each([
    { name: "open band", solids: [], target, x: 120 },
    { name: "high ground at the band's top edge", solids: [], target: { ...target, y: 0 }, x: 0 },
    { name: "full solid cover", solids: [wall], target, x: 0 },
    {
      name: "an exposed slice above low cover",
      solids: [{ ...wall, height: 20, y: 40 }],
      target,
      x: 120,
    },
    {
      name: "combined solid cover",
      solids: [
        { ...wall, height: 20 },
        { ...wall, height: 20, y: 40 },
      ],
      target,
      x: 0,
    },
    { name: "a solid beyond the target", solids: [{ ...wall, x: 90 }], target, x: 120 },
  ])("resolves $name", ({ solids, target, x }) => {
    expect(forcePulseVelocity(solids, 0.5, [pulse], target)).toEqual({ x, y: 0 });
  });

  it("mirrors the captured direction and volume without moving the source", () => {
    const left = { ...pulse, facing: -1 as const, velocity: { x: 120, y: 40 } };
    expect(forcePulseVolume(left)).toEqual({ height: 40, width: 100, x: -100, y: 20 });
    expect(forcePulseVelocity([], 0.5, [left], { ...target, x: -60 })).toEqual({ x: -120, y: 40 });
    expect(forcePulseVelocity([{ ...wall, x: -40 }], 0.5, [left], { ...target, x: -60 })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("clips new and expiring gusts to the current step and sums only active overlaps", () => {
    const pulses = [
      { ...pulse, remaining: 0.25, start: 0.25 },
      { ...pulse, remaining: 0.5 },
      { ...pulse, start: 2 },
    ];
    expect(forcePulseVelocity([], 1, pulses, target)).toEqual({ x: 90, y: 0 });
    expect(forcePulseVelocity([], 1, pulses, { ...target, x: 200 })).toEqual({ x: 0, y: 0 });
    expect(forcePulseVelocity([], 1, [{ ...pulse, remaining: 0 }], target)).toEqual({ x: 0, y: 0 });
  });
});
