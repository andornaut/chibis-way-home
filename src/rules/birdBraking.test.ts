import { describe, expect, it } from "vitest";

import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import type { BirdTuning, Rect } from "../data/types";
import { type BirdInput, type BirdState, startBird, stepBird } from "./bird";

const floor: Rect = { height: 40, width: 4000, x: -2000, y: 300 };
const neutral: BirdInput = { jumpHeld: false, move: 0 };
function initial(grounded: boolean, vx: number): BirdState {
  return { ...startBird(BIRD, { x: 0, y: grounded ? floor.y : 100 }), grounded, vx };
}
function trace(
  tuning: BirdTuning,
  ticks: number,
  input: BirdInput,
  bird: BirdState,
): readonly BirdState[] {
  const result: BirdState[] = [];
  let state = bird;
  for (let tick = 0; tick < ticks; tick++) {
    state = stepBird(tuning, [floor], [], STEP_SECONDS, input, state);
    result.push(state);
  }
  return result;
}

describe("neutral-input braking", () => {
  it.each([false, true])(
    "stops sooner with less drift in grounded=%s, without reversing",
    (grounded) => {
      const previous = { ...BIRD, brakeAccel: grounded ? BIRD.groundAccel : BIRD.airAccel };
      const ticks = Math.ceil(BIRD.walkSpeed / previous.brakeAccel / STEP_SECONDS) + 1;
      for (const direction of [-1, 1]) {
        const start = initial(grounded, direction * BIRD.walkSpeed);
        const slow = trace(previous, ticks, neutral, start);
        const fast = trace(BIRD, ticks, neutral, start);
        const stopped = (states: readonly BirdState[]) => states.findIndex(({ vx }) => vx === 0);
        expect(stopped(fast)).toBeGreaterThanOrEqual(0);
        expect(stopped(fast)).toBeLessThan(stopped(slow));
        expect(Math.abs(fast.at(-1)!.x - start.x)).toBeLessThan(Math.abs(slow.at(-1)!.x - start.x));
        expect(fast.every(({ vx }) => vx * direction >= 0)).toBe(true);
        expect(fast.map(({ grounded, vy, y }) => ({ grounded, vy, y }))).toEqual(
          slow.map(({ grounded, vy, y }) => ({ grounded, vy, y })),
        );
      }
    },
  );
  it.each([false, true])(
    "preserves the complete directional and reversal traces in grounded=%s",
    (grounded) => {
      const previous = { ...BIRD, brakeAccel: grounded ? BIRD.groundAccel : BIRD.airAccel };
      const accel = grounded ? BIRD.groundAccel : BIRD.airAccel;
      const ticks = Math.ceil((2 * BIRD.walkSpeed) / accel / STEP_SECONDS) + 1;
      for (const vx of [0, -BIRD.walkSpeed]) {
        const start = initial(grounded, vx);
        const input = { ...neutral, move: 1 as const };
        expect(trace(BIRD, ticks, input, start)).toEqual(trace(previous, ticks, input, start));
      }
    },
  );
});
