import { describe, expect, it } from "vitest";

import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import type { BirdTuning, Rect } from "../data/types";
import { startBird, stepBird } from "./bird";

const tuning: BirdTuning = BIRD;
const floor: Rect = { height: 40, width: 4000, x: -2000, y: 300 };
const idle = { jumpHeld: false, move: 0 } as const;

describe("finite horizontal dash", () => {
  it.each([false, true])(
    "preserves vertical physics and ends without a speed tail, grounded=%s",
    (grounded) => {
      for (const direction of [-1, 1] as const) {
        let burst = {
          ...startBird(tuning, { x: 0, y: grounded ? floor.y : -1000 }),
          facing: direction,
          grounded,
        };
        let ordinary = burst;
        const x = burst.x;
        const ticks = Math.ceil(tuning.dash!.durationSeconds / STEP_SECONDS);
        for (let tick = 0; tick < ticks; tick++) {
          burst = stepBird(
            tuning,
            [floor],
            [],
            STEP_SECONDS,
            { ...idle, dashPressed: tick === 0 },
            burst,
          );
          ordinary = stepBird(tuning, [floor], [], STEP_SECONDS, idle, ordinary);
          expect({ grounded: burst.grounded, vy: burst.vy, y: burst.y }).toEqual({
            grounded: ordinary.grounded,
            vy: ordinary.vy,
            y: ordinary.y,
          });
        }
        expect(burst.x - x).toBeCloseTo(
          direction * tuning.dash!.speed * tuning.dash!.durationSeconds,
        );
        expect(burst.dash!.remainingSeconds).toBe(0);
        expect(burst.vx).toBe(0);
        const after = stepBird(tuning, [floor], [], STEP_SECONDS, idle, burst);
        expect(after.x).toBe(burst.x);
      }
    },
  );

  it("captures direction once while ordinary steering continues independently", () => {
    let bird = { ...startBird(tuning, { x: 0, y: floor.y }), grounded: true };
    bird = stepBird(
      tuning,
      [floor],
      [],
      STEP_SECONDS,
      { ...idle, dashPressed: true, move: 1 },
      bird,
    );
    const start = bird.x;
    bird = stepBird(tuning, [floor], [], STEP_SECONDS, { ...idle, move: -1 }, bird);
    expect(bird.x).toBeGreaterThan(start);
    expect(bird.dash!.direction).toBe(1);
    expect(Math.abs(bird.dash!.ordinaryVx)).toBeLessThanOrEqual(tuning.walkSpeed);
  });

  it("requires cooldown and restores the single air charge only after actual landing", () => {
    let bird = startBird(tuning, { x: 0, y: -1000 });
    bird = stepBird(tuning, [], [], STEP_SECONDS, { ...idle, dashPressed: true }, bird);
    expect(bird.dash!.airUsed).toBe(true);
    for (let tick = 0; tick < Math.ceil(tuning.dash!.cooldownSeconds / STEP_SECONDS); tick++) {
      bird = stepBird(tuning, [], [], STEP_SECONDS, idle, bird);
    }
    const before = bird.x;
    bird = stepBird(tuning, [], [], STEP_SECONDS, { ...idle, dashPressed: true }, bird);
    expect(bird.x).toBe(before);
    expect(bird.dash!.remainingSeconds).toBe(0);
    bird = stepBird(tuning, [floor], [], STEP_SECONDS, idle, {
      ...bird,
      vy: 0,
      y: floor.y - tuning.height,
    });
    expect(bird.grounded).toBe(true);
    expect(bird.dash!.airUsed).toBe(false);
    bird = stepBird(tuning, [floor], [], STEP_SECONDS, { ...idle, dashPressed: true }, bird);
    expect(bird.dash!.remainingSeconds).toBeGreaterThan(0);
  });

  it.each([-1, 1] as const)("clips continuously at a thin solid in direction %s", (direction) => {
    const wall = { height: 1000, width: 1, x: direction > 0 ? 50 : -50, y: -500 };
    const bird = { ...startBird(tuning, { x: 0, y: 0 }), facing: direction };
    const end = stepBird(
      tuning,
      [wall],
      [],
      tuning.dash!.durationSeconds,
      { ...idle, dashPressed: true },
      bird,
    );
    expect(end.x).toBe(direction > 0 ? wall.x - tuning.width : wall.x + wall.width);
    expect(end.vx).toBe(0);
    expect(end.dash!.remainingSeconds).toBe(0);
  });
});
