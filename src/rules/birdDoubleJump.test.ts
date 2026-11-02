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
  it.each(["solid", "ledge"] as const)(
    "starts the full first jump on a newly spawned %s support",
    (kind) => {
      const solids = kind === "solid" ? [floor] : [];
      const ledges = kind === "ledge" ? [floor] : [];
      const spawned = startBird(tuning, { x: 0, y: floor.y });
      const settled = stepBird(tuning, solids, ledges, STEP_SECONDS, idle, spawned);
      expect(spawned.grounded).toBe(false);
      expect(settled.grounded).toBe(true);
      const first = stepBird(tuning, solids, ledges, STEP_SECONDS, jump, spawned);
      const expected = stepBird(tuning, solids, ledges, STEP_SECONDS, jump, settled);
      expect(first).toEqual(expected);
      expect(first.airJumpUsed).toBe(false);
    },
  );

  it("keeps an edge-adjacent unsupported press as the shorter airborne jump", () => {
    const spawned = startBird(tuning, { x: floor.x + floor.width + tuning.width / 2, y: floor.y });
    const next = stepBird(tuning, [floor], [], STEP_SECONDS, jump, spawned);
    expect(next.airJumpUsed).toBe(true);
    expect(next).toEqual(stepBird(tuning, [], [], STEP_SECONDS, jump, spawned));
  });

  it("does not turn rising pass-through contact with a ledge into a ground jump", () => {
    const rising = step(step(standing(), true), false, []);
    expect(rising.vy).toBeLessThan(0);
    const ledge = { ...floor, y: rising.y + tuning.height };
    const result = stepBird(tuning, [], [ledge], STEP_SECONDS, jump, rising);
    expect(result).toEqual(stepBird(tuning, [], [], STEP_SECONDS, jump, rising));
    expect(result.airJumpUsed).toBe(true);
  });

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

  function readyForAirJump(phase: "rising" | "falling") {
    let bird = step(standing(), true);
    if (phase === "rising") {
      for (let tick = 0; tick < 6; tick++) {
        bird = step(bird, true, []);
      }
    } else {
      while (bird.vy < 0) {
        bird = step(bird, true, []);
      }
    }
    return step(bird, false, []);
  }

  function ascent(before: BirdState, heldTicks: number, profile = tuning) {
    let bird = before;
    const states: BirdState[] = [];
    const ticks = Math.ceil((2 * profile.jumpRiseTime) / STEP_SECONDS);
    for (let tick = 0; tick < ticks; tick++) {
      bird = step(bird, tick < heldTicks, [], profile);
      states.push(bird);
    }
    return { rise: before.y - Math.min(...states.map((state) => state.y)), states };
  }

  it.each(["rising", "falling"] as const)(
    "limits the airborne jump to its authored share of normal height while %s",
    (phase) => {
      const before = readyForAirJump(phase);
      expect(phase === "rising" ? before.vy < 0 : before.vy >= 0).toBe(true);
      const normal = ascent(standing(), Infinity);
      const second = ascent(before, Infinity);
      const tolerance = tuning.gravity * STEP_SECONDS ** 2;
      expect(
        Math.abs(second.rise - normal.rise * tuning.doubleJumpHeightRatio),
      ).toBeLessThanOrEqual(tolerance);
      expect(second.states[0]!.jumpFromY).toBe(before.y);
      expect(second.states[0]!.airJumpUsed).toBe(true);
      expect(second.states[0]!.vy).toBeLessThan(0);
      const apex = second.states.findIndex((state) => state.vy >= 0);
      expect(second.states[apex + 1]!.vy - second.states[apex]!.vy).toBeCloseTo(
        tuning.gravity * STEP_SECONDS,
      );
    },
  );

  it("retains responsive tap release without exceeding the second-jump height cap", () => {
    const before = readyForAirJump("rising");
    const held = ascent(before, Infinity);
    const normal = ascent(standing(), Infinity);
    const cap = normal.rise * tuning.doubleJumpHeightRatio;
    const holds = [
      1,
      Math.ceil(tuning.jumpTapWindow / STEP_SECONDS),
      Math.ceil((tuning.jumpTapWindow + tuning.jumpReleaseBlendTime / 2) / STEP_SECONDS),
    ];
    for (const hold of holds) {
      const released = ascent(before, hold);
      expect(released.rise).toBeLessThanOrEqual(cap + tuning.gravity * STEP_SECONDS ** 2);
      const rising = released.states.slice(hold).filter((state) => state.vy < 0);
      expect(rising.every((state, index) => index === 0 || state.vy >= rising[index - 1]!.vy)).toBe(
        true,
      );
    }
    expect(ascent(before, 1).rise).toBeLessThan(held.rise);
  });

  it("leaves every first-jump state unchanged by the airborne height ratio", () => {
    let limited = standing(),
      normal = standing();
    const control = { ...tuning, doubleJumpHeightRatio: 1 };
    for (let tick = 0; tick < 120; tick++) {
      const held = tick < Math.ceil(tuning.jumpRiseTime / STEP_SECONDS);
      limited = step(limited, held, [floor]);
      normal = step(normal, held, [floor], control);
      expect(limited).toEqual(normal);
    }
  });

  it("preserves carry and ceiling collision, restoring the charge only on supported landing", () => {
    const before = { ...readyForAirJump("rising"), carryVx: 60 };
    const ordinary = step(before, false, []);
    let bird = step(before, true, []);
    expect(bird.x).toBe(ordinary.x);
    expect(bird.carryVx).toBe(before.carryVx);
    const ceiling = { height: 5, width: 400, x: -200, y: bird.y - 10 };
    for (let tick = 0; tick < 10; tick++) {
      bird = step(bird, true, [ceiling]);
    }
    expect(bird.y).toBeGreaterThanOrEqual(ceiling.y + ceiling.height);
    expect(bird.jumpRise).toBe("free");
    expect(bird.airJumpUsed).toBe(true);
    for (let tick = 0; tick < 120 && !bird.grounded; tick++) {
      bird = step(bird, false, [floor]);
    }
    expect(bird.grounded).toBe(true);
    expect(bird.airJumpUsed).toBe(false);
    expect(bird.carryVx).toBe(0);
  });

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
