import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { BirdTuning, Rect } from "../data/types";
import { type BirdState, startBird, stepBird } from "./bird";
import { STEP_SECONDS } from "./step";

const tuning: BirdTuning = { ...BIRD, doubleJump: true };
const floor: Rect = { height: 40, width: 4000, x: -2000, y: 300 };
const idle = { jumpHeld: false, move: 0 } as const;
const jump = { ...idle, jumpHeld: true };
function step(bird: BirdState, held: boolean, solids: readonly Rect[] = [floor], profile = tuning) {
  return stepBird(profile, solids, [], STEP_SECONDS, { ...idle, jumpHeld: held }, bird);
}
function standing() {
  return step(startBird(tuning, { x: 0, y: floor.y }), false);
}

describe("one additional airborne jump", () => {
  it("requires a fresh press and never grants a third jump before supported landing", () => {
    let bird = step(standing(), true);
    expect(bird.airJumpUsed).toBe(false);
    for (let tick = 0; tick < 5; tick++) {
      bird = step(bird, true);
    }
    expect(bird.airJumpUsed).toBe(false);
    bird = step(step(bird, false), true);
    expect(bird.airJumpUsed).toBe(true);
    const secondStart = bird.jumpFromY;
    bird = step(bird, false);
    const expected = step(bird, true, [floor], { ...tuning, doubleJump: false });
    bird = step(bird, true);
    expect(bird).toEqual(expected);
    expect(bird.jumpFromY).toBe(secondStart);
  });

  it.each([1, 30])(
    "uses the same relative tap/hold ascent on the second jump, held ticks=%s",
    (heldTicks) => {
      let airborne = step(step(standing(), true), false);
      const from = airborne.y;
      let primary = { ...standing(), y: from };
      for (let tick = 0; tick < 80; tick++) {
        const held = tick < heldTicks;
        airborne = step(airborne, held, []);
        primary = step(primary, held, []);
        expect({ vy: airborne.vy, y: airborne.y }).toEqual({ vy: primary.vy, y: primary.y });
      }
      expect(airborne.airJumpUsed).toBe(true);
    },
  );

  it("keeps a coyote jump separate from the single airborne charge", () => {
    let bird = { ...startBird(tuning, { x: 0, y: 0 }), coyoteLeft: tuning.coyoteTime };
    bird = step(bird, true, []);
    expect(bird.airJumpUsed).toBe(false);
    bird = step(step(bird, false, []), true, []);
    expect(bird.airJumpUsed).toBe(true);
    expect(bird.vy).toBeLessThan(0);
  });

  it("retains released jump buffering after the charge is spent and restores it only on actual landing", () => {
    let bird = { ...startBird(tuning, { x: 0, y: 0 }), airJumpUsed: true, vy: 100 };
    bird = step(bird, true, []);
    expect(bird.bufferLeft).toBeGreaterThan(0);
    bird = step({ ...bird, y: floor.y - tuning.height - 0.1 }, false);
    expect(bird.grounded).toBe(true);
    expect(bird.airJumpUsed).toBe(false);
    bird = step(bird, false);
    expect(bird.vy).toBeLessThan(0);
    expect(bird.jumpRise).toBe("hop");
    expect(bird.airJumpUsed).toBe(false);
  });

  it("does not restore either airborne charge when using the other ability", () => {
    const profile = {
      ...tuning,
      dash: { cooldownSeconds: 0.65, durationSeconds: 0.14, speed: 640 },
    };
    let bird = startBird(profile, { x: 0, y: 0 });
    bird = stepBird(profile, [], [], STEP_SECONDS, { ...jump, dashPressed: true }, bird);
    expect(bird.airJumpUsed).toBe(true);
    expect(bird.dash!.airUsed).toBe(true);
    bird = stepBird(profile, [], [], STEP_SECONDS, idle, bird);
    const normal = stepBird({ ...profile, doubleJump: false }, [], [], STEP_SECONDS, jump, bird);
    expect(stepBird(profile, [], [], STEP_SECONDS, jump, bird)).toEqual(normal);
  });
});
