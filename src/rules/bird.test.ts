import { describe, expect, it } from "vitest";

import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { SKILLS } from "../data/skills";
import type { Rect } from "../data/types";
import {
  type BirdInput,
  type BirdState,
  ordinaryFallVelocity,
  ordinaryHorizontalVelocity,
  ordinaryJumpApexFeetY,
  ordinaryJumpAscent,
  startBird,
  stepBird,
  stepBirdWithSupport,
} from "./bird";
import { SKILL_IDS, skillTuning } from "./skills";

const STEP = STEP_SECONDS;
const GROUND: Rect = { height: 40, width: 2000, x: -1000, y: 300 };
const IDLE: BirdInput = { jumpHeld: false, move: 0 };
const SINGLE_JUMP = { ...BIRD, doubleJump: false };

describe("resolved standing support", () => {
  it("reports the selected terrain reference and clears it on a real jump and walk-off", () => {
    const initial = startBird(BIRD, { x: 0, y: GROUND.y });
    const landed = stepBirdWithSupport(BIRD, [GROUND], [], STEP, IDLE, initial);
    expect(landed.bird).toEqual(stepBird(BIRD, [GROUND], [], STEP, IDLE, initial));
    expect(landed.support).toBe(GROUND);
    const jumped = stepBirdWithSupport(
      BIRD,
      [GROUND],
      [],
      STEP,
      { jumpHeld: true, move: 0 },
      landed.bird,
    );
    expect(jumped.support).toBeUndefined();
    expect(jumped.bird.grounded).toBe(false);
    const ledge = { height: 40, width: 40, x: -20, y: GROUND.y };
    let bird = stepBird(BIRD, [ledge], [], STEP, IDLE, initial);
    let lastSupport: Rect | undefined = ledge;
    for (let tick = 0; tick < 30; tick++) {
      const input = { jumpHeld: false, move: 1 as const };
      const next = stepBirdWithSupport(BIRD, [ledge], [], STEP, input, bird);
      expect(next.bird).toEqual(stepBird(BIRD, [ledge], [], STEP, input, bird));
      bird = next.bird;
      lastSupport = next.support;
    }
    expect(bird.grounded).toBe(false);
    expect(lastSupport).toBeUndefined();
  });

  it.each(["solid", "ledge"] as const)(
    "retains actual %s candidate order for coincident surfaces",
    (kind) => {
      const first = { height: 12, width: 100, x: -50, y: 200 };
      const second = { ...first };
      for (const surfaces of [
        [first, second],
        [second, first],
      ]) {
        const solids = kind === "solid" ? surfaces : [];
        const ledges = kind === "ledge" ? surfaces : [];
        let bird = startBird(BIRD, { x: 0, y: 100 });
        let support: Rect | undefined;
        for (let tick = 0; tick < 120 && !bird.grounded; tick++) {
          const next = stepBirdWithSupport(BIRD, solids, ledges, STEP, IDLE, bird);
          expect(next.bird).toEqual(stepBird(BIRD, solids, ledges, STEP, IDLE, bird));
          bird = next.bird;
          support = next.support;
        }
        expect(bird.grounded).toBe(true);
        expect(support).toBe(surfaces[0]);
      }
    },
  );

  it.each(["solid", "ledge"] as const)(
    "reports the strict-winning pushedPosition %s landing",
    (kind) => {
      const lower = { height: 2, width: 100, x: -50, y: 260 };
      const upper = { ...lower, y: 200 };
      const tied = { ...upper };
      const solids = kind === "solid" ? [lower, upper, tied] : [lower];
      const ledges = kind === "ledge" ? [upper, tied] : [];
      const initial = startBird(BIRD, { x: 0, y: 100 });
      const input = { ...IDLE, push: { x: 0, y: 24_000 } };
      const result = stepBirdWithSupport(BIRD, solids, ledges, STEP, input, initial);
      expect(result.bird).toEqual(stepBird(BIRD, solids, ledges, STEP, input, initial));
      expect(result.bird.grounded).toBe(true);
      expect(result.bird.y + BIRD.height).toBe(upper.y);
      expect(result.support).toBe(upper);
    },
  );

  it("does not report a ceiling clamp as standing support", () => {
    const ceiling = { height: 12, width: 100, x: -50, y: 100 };
    const initial = startBird(BIRD, { x: 0, y: 250 });
    const input = { ...IDLE, push: { x: 0, y: -24_000 } };
    const result = stepBirdWithSupport(BIRD, [ceiling], [], STEP, input, initial);
    expect(result.bird).toEqual(stepBird(BIRD, [ceiling], [], STEP, input, initial));
    expect(result.bird.y).toBe(ceiling.y + ceiling.height);
    expect(result.bird.grounded).toBe(false);
    expect(result.support).toBeUndefined();
  });
});

// Steps her from a standing start on GROUND, with input(step) each step; returns every state.
function run(
  steps: number,
  input: (step: number) => BirdInput,
  solids = [GROUND],
  tuning = BIRD,
): BirdState[] {
  let bird = stepBird(tuning, solids, [], STEP, IDLE, startBird(tuning, { x: 0, y: GROUND.y }));
  const states = [bird];
  for (let step = 0; step < steps; step++) {
    bird = stepBird(tuning, solids, [], STEP, input(step), bird);
    states.push(bird);
  }
  return states;
}

// A short jump from the ground, and optionally a second press on pressStep.
function hop(pressStep?: number, tuning = BIRD): BirdState[] {
  return run(
    600,
    (step) => ({ jumpHeld: step < 2 || step === pressStep, move: 0 }),
    [GROUND],
    tuning,
  );
}

// Walking right off a narrow ledge, and optionally a jump press on jumpStep.
const LEDGE: Rect = { height: 40, width: 40, x: -20, y: 300 };
function walkOff(jumpStep?: number, tuning = BIRD): BirdState[] {
  return run(120, (step) => ({ jumpHeld: step === jumpStep, move: 1 }), [LEDGE], tuning);
}

const last = (states: BirdState[]) => states[states.length - 1] as BirdState;

it("uses shared ordinary velocity primitives during actual ground, air and falling steps", () => {
  const input = (tick: number): BirdInput => ({ jumpHeld: tick < 44, move: tick < 60 ? 1 : 0 });
  const states = run(100, input);
  let falling = 0;
  for (let tick = 0; tick < 100; tick++) {
    const before = states[tick]!;
    const after = states[tick + 1]!;
    expect(after.vx).toBe(
      ordinaryHorizontalVelocity(BIRD, STEP, input(tick).move, before.grounded, before.vx),
    );
    if (before.vy >= 0 && !after.grounded && tick > 44) {
      expect(after.vy).toBe(ordinaryFallVelocity(BIRD, STEP, before.vy));
      falling++;
    }
  }
  expect(falling).toBeGreaterThan(20);
});

it("exposes the actual full-jump ascent through the first native apex crossing", () => {
  const count = Math.ceil(BIRD.jumpRiseTime / STEP);
  const states = run(count, () => ({ jumpHeld: true, move: 0 }));
  for (let tick = 1; tick <= count; tick++) {
    const sample = ordinaryJumpAscent(BIRD, tick * STEP);
    expect(sample.rise).toBeCloseTo(states[0]!.y - states[tick]!.y, 8);
    expect(sample.velocity).toBeCloseTo(states[tick]!.vy, 8);
    expect(sample.rise).toBeLessThanOrEqual(sample.apexRise);
  }
  expect(() => ordinaryJumpAscent(BIRD, (count + 1) * STEP)).toThrow(RangeError);
});

it.each([null, ...SKILL_IDS])(
  "bounds every native release from tap to full hold under the %s profile",
  (selected) => {
    const tuning = skillTuning(SKILLS, selected, BIRD);
    const fullHold = Math.ceil(tuning.jumpRiseTime / STEP) + 1;
    for (const offset of [0, 480]) {
      const ground = { ...GROUND, y: GROUND.y + offset };
      const jump = (release: number) => {
        let bird = stepBird(
          tuning,
          [ground],
          [],
          STEP,
          IDLE,
          startBird(tuning, { x: 0, y: ground.y }),
        );
        const takeoffY = bird.y;
        let peak = Infinity;
        for (let tick = 0; tick < 120; tick++) {
          bird = stepBird(tuning, [ground], [], STEP, { jumpHeld: tick < release, move: 0 }, bird);
          if (tick === 0) {
            expect(bird.jumpFromY).toBe(takeoffY);
            expect(bird.vy).toBeLessThan(0);
          }
          peak = Math.min(peak, bird.y + tuning.height);
        }
        return { peak, takeoffY };
      };
      const releases = Array.from({ length: fullHold }, (_, index) => jump(index + 1));
      const highest = Math.min(...releases.map(({ peak }) => peak));
      const bound = ordinaryJumpApexFeetY(tuning, releases[0]!.takeoffY);
      expect(bound).toBeGreaterThanOrEqual(highest);
      expect(bound - highest).toBeLessThan(1e-6);
      expect(bound).toBeLessThanOrEqual(releases.at(-1)!.peak);
      expect(releases[0]!.peak).toBeGreaterThan(highest);
    }
  },
);
const lowestY = (states: BirdState[]) => Math.min(...states.map((state) => state.y));
const startY = GROUND.y - BIRD.height;

describe("stepBird", () => {
  it("stands on the ground", () => {
    const states = run(120, () => IDLE);
    expect(states.every((state) => state.grounded && state.y === startY)).toBe(true);
  });

  it.each([1, -1] as const)("walks toward %i at walk speed", (move) => {
    const states = run(60, () => ({ jumpHeld: false, move }));
    expect(last(states).vx).toBe(move * BIRD.walkSpeed);
    expect(last(states).facing).toBe(move);
  });

  // Jump held for a press's seconds from a standing start: every state.
  const press = (tuning: typeof BIRD, seconds: number) =>
    run(240, (step) => ({ jumpHeld: step * STEP < seconds, move: 0 }), [GROUND], tuning);
  // How high she rises for a press.
  const rise = (tuning: typeof BIRD, seconds: number) => startY - lowestY(press(tuning, seconds));
  const { gravity, jumpHopHeight, jumpReleaseBlendTime, jumpRiseTime, jumpSpeed, jumpTapWindow } =
    BIRD;
  const full = jumpSpeed ** 2 / (2 * gravity);
  const within = jumpSpeed * STEP;

  it.each([STEP, 0.06, jumpTapWindow])(
    "keeps a %fs tap at the low-hop height and starts moving immediately",
    (seconds) => {
      const states = press(BIRD, seconds);
      expect(states[1]?.vy).toBeLessThan(0);
      expect(states[1]?.y).toBeLessThan(startY);
      expect(Math.abs(startY - lowestY(states) - jumpHopHeight)).toBeLessThan(1);
    },
  );

  it("adds height progressively through the release blend", () => {
    const heights = Array.from({ length: Math.ceil(jumpReleaseBlendTime / STEP) + 2 }, (_, step) =>
      rise(BIRD, jumpTapWindow + step * STEP),
    );
    expect(heights.every((height, i) => i === 0 || height + 0.05 >= (heights[i - 1] ?? 0))).toBe(
      true,
    );
    expect(Math.abs((heights.at(-1) ?? 0) - full)).toBeLessThan(within);
  });

  it("slows a held ascent continuously without an upward reboost or apex pause", () => {
    const states = press(BIRD, 1);
    const rising = states.filter((state) => state.vy < 0);
    for (let i = 1; i < rising.length; i++) {
      expect(rising[i]!.vy).toBeGreaterThan(rising[i - 1]!.vy);
    }
    const apex = states.findIndex((state, index) => index > 1 && state.vy >= 0);
    expect(Math.abs(apex * STEP - jumpRiseTime)).toBeLessThanOrEqual(STEP);
    expect(states.slice(1, apex + 2).every((state, index) => state.y !== states[index]!.y)).toBe(
      true,
    );
  });

  const probeStep = STEP / 1000;
  const accelerationTolerance = gravity * Math.sqrt(probeStep / STEP);
  const checkApex = (remaining: number, held: boolean, state: BirdState) => {
    const input = { jumpHeld: held, move: 0 as const };
    const before = stepBird(BIRD, [GROUND], [], remaining - probeStep, input, state);
    const apex = stepBird(BIRD, [GROUND], [], probeStep, input, before);
    const after = stepBird(BIRD, [GROUND], [], probeStep, input, apex);
    expect(before.vy).toBeLessThan(0);
    expect(after.vy).toBeGreaterThan(0);
    expect(Math.abs((apex.vy - before.vy) / probeStep - gravity)).toBeLessThan(
      accelerationTolerance,
    );
    expect((after.vy - apex.vy) / probeStep).toBeCloseTo(gravity);
    expect(apex.y).toBeLessThan(before.y);
    expect(after.y).toBeGreaterThan(apex.y);
  };

  it.each([
    STEP,
    jumpTapWindow,
    jumpTapWindow + jumpReleaseBlendTime / 2,
    jumpTapWindow + jumpReleaseBlendTime,
  ])("keeps release and apex velocity/acceleration continuous after %fs", (heldFor) => {
    const states = press(BIRD, heldFor);
    const index = states.findIndex(
      (state, i) => i > 0 && !state.jumpHeld && states[i - 1]!.jumpHeld,
    );
    const before = states[index - 1]!;
    const released = stepBird(BIRD, [GROUND], [], probeStep, { jumpHeld: false, move: 0 }, before);
    const held = stepBird(BIRD, [GROUND], [], probeStep, { jumpHeld: true, move: 0 }, before);
    expect(Math.abs(released.vy - held.vy)).toBeLessThan(accelerationTolerance * probeStep);
    expect(
      Math.abs((released.vy - before.vy) / probeStep - (held.vy - before.vy) / probeStep),
    ).toBeLessThan(accelerationTolerance);
    const curve = released.jumpRelease;
    expect(curve).toBeDefined();
    checkApex(curve!.seconds - curve!.elapsed, false, released);
    const rising = states.filter((state) => state.vy < 0);
    expect(rising.every((state, i) => i === 0 || state.vy > rising[i - 1]!.vy)).toBe(true);
  });

  it("joins normal gravity continuously at the full held apex", () => {
    const states = press(BIRD, 1);
    const before = states[Math.floor(jumpRiseTime / STEP)]!;
    checkApex(jumpRiseTime - before.jumpHeldFor, true, before);
  });

  it("preserves full-jump height without pausing or reversing during ascent", () => {
    const states = press(BIRD, 1);
    const transitionEnd = Math.ceil((jumpTapWindow + jumpReleaseBlendTime) / STEP);
    expect(states.slice(1, transitionEnd + 1).every((state) => state.vy < 0)).toBe(true);
    expect(Math.abs(startY - lowestY(states) - full)).toBeLessThan(within);
    const apex = states.findIndex((state, index) => index > 1 && state.vy >= 0);
    expect(states[apex + 1]?.vy).toBeGreaterThan(states[apex]?.vy ?? 0);
  });

  it("uses normal gravity immediately after the low-hop apex", () => {
    const states = press(BIRD, STEP);
    const apex = states.findIndex((state, index) => index > 1 && state.vy >= 0);
    expect(apex * STEP).toBeLessThan(jumpRiseTime + 2 * STEP);
    expect((states[apex + 1]?.vy ?? 0) - (states[apex]?.vy ?? 0)).toBeCloseTo(gravity * STEP);
  });

  it("does not regain speed during a released hop when the separate air jump is disabled", () => {
    const states = run(
      120,
      (step) => ({
        jumpHeld: step === 0 || (step > 4 && step < 20),
        move: 0,
      }),
      [GROUND],
      SINGLE_JUMP,
    );
    expect(Math.abs(startY - lowestY(states) - jumpHopHeight)).toBeLessThan(1);
  });

  it("hops when a buffered jump's button was already released", () => {
    const land = hop(undefined, SINGLE_JUMP).findIndex((state, i) => i > 2 && state.grounded);
    const press = land - 3;
    const states = run(
      600,
      (step) => ({ jumpHeld: step < 2 || step === press, move: 0 }),
      [GROUND],
      SINGLE_JUMP,
    );
    const after = states.slice(land);
    const hopApex = BIRD.jumpHopHeight;
    expect(Math.abs(startY - lowestY(after) - hopApex)).toBeLessThanOrEqual(BIRD.jumpSpeed * STEP);
  });

  it.each([
    ["after a jump", run(600, (step) => ({ jumpHeld: step < 120, move: 0 }))],
    ["off a ledge", walkOff()],
  ])("falls at the flutter speed at most %s", (_name, states) => {
    const falling = states.filter((state) => state.vy > 0 && !state.grounded);
    expect(falling.length).toBeGreaterThan(0);
    expect(Math.max(...falling.map((state) => state.vy))).toBe(BIRD.flutterFallSpeed);
  });

  // A press on step s acts on the state after step s - 1; that state's coyote time has run
  // for (s - leave) steps since states[leave], the first one in the air.
  it.each([
    ["within coyote time", Math.floor(BIRD.coyoteTime / STEP) - 1, true],
    ["after coyote time", Math.ceil(BIRD.coyoteTime / STEP) + 1, false],
  ])("jumps when pressed %s after leaving a ledge", (_name, after, jumps) => {
    const leave = walkOff().findIndex((state) => !state.grounded);
    const states = walkOff(leave - 1 + after, SINGLE_JUMP);
    expect(states.some((state) => state.vy < 0)).toBe(jumps);
  });

  // A press kept in the buffer starts a jump on the step after she lands, so the buffer must
  // outlast the steps to landing plus one.
  it.each([
    ["within the buffer", Math.floor(BIRD.jumpBuffer / STEP) - 2, true],
    ["before the buffer", Math.ceil(BIRD.jumpBuffer / STEP) + 1, false],
  ])("jumps as she lands when pressed %s", (_name, before, jumps) => {
    const land = hop(undefined, SINGLE_JUMP).findIndex((state, i) => i > 2 && state.grounded);
    const states = hop(land - 1 - before, SINGLE_JUMP);
    expect(states.slice(land).some((state) => state.vy < 0)).toBe(jumps);
  });

  it("hops lower when Jump is released early", () => {
    const held = run(120, () => ({ jumpHeld: true, move: 0 }));
    const tapped = run(120, (step) => ({ jumpHeld: step < 4, move: 0 }));
    expect(lowestY(tapped)).toBeGreaterThan(lowestY(held));
  });

  it("lands after a jump", () => {
    expect(last(hop())).toMatchObject({ grounded: true, vy: 0, y: startY });
  });

  it.each([
    [
      1,
      { height: 100, width: 20, x: 40, y: 200 },
      (x: number, wall: Rect) => x + BIRD.width <= wall.x,
    ],
    [
      -1,
      { height: 100, width: 20, x: -60, y: 200 },
      (x: number, wall: Rect) => x >= wall.x + wall.width,
    ],
  ] as const)("stops at a wall moving %i", (move, wall, clear) => {
    const states = run(120, () => ({ jumpHeld: false, move }), [GROUND, wall]);
    expect(states.every((state) => clear(state.x, wall))).toBe(true);
    expect(last(states).vx).toBe(0);
  });

  it("stops rising at a ceiling", () => {
    const ceiling: Rect = { height: 10, width: 200, x: -100, y: startY - 30 };
    const states = run(60, () => ({ jumpHeld: true, move: 0 }), [GROUND, ceiling]);
    expect(lowestY(states)).toBe(ceiling.y + ceiling.height);
  });
});

describe("external push", () => {
  it.each([false, true])("adds vertical push during a released=%s ascent", (released) => {
    const before = run(6, () => ({ jumpHeld: true, move: 0 })).at(-1)!;
    const input = { jumpHeld: !released, move: 0 as const };
    const baseline = stepBird(BIRD, [], [], STEP, input, before);
    const pushed = stepBird(BIRD, [], [], STEP, { ...input, push: { x: 0, y: 120 } }, before);
    expect(pushed.y).toBeCloseTo(baseline.y + 120 * STEP);
    expect(pushed.vy).toBe(baseline.vy);
    expect(pushed.jumpRelease).toEqual(baseline.jumpRelease);
  });

  it.each([false, true])(
    "pushes with grounded=%s without adding locomotion or carry momentum",
    (grounded) => {
      const bird = { ...startBird(BIRD, { x: 0, y: GROUND.y }), grounded };
      const solids = grounded ? [GROUND] : [];
      const baseline = stepBird(BIRD, solids, [], STEP, IDLE, bird);
      const pushed = stepBird(BIRD, solids, [], STEP, { ...IDLE, push: { x: 120, y: 0 } }, bird);
      expect(pushed.x).toBeCloseTo(baseline.x + 120 * STEP);
      expect(pushed.vx).toBe(baseline.vx);
      expect(pushed.carryVx).toBe(baseline.carryVx);
      expect(stepBird(BIRD, solids, [], STEP, IDLE, pushed).x).toBe(pushed.x);
    },
  );

  it.each([
    { axis: "x" as const, direction: 1, solid: { height: 200, width: 1, x: 50, y: -100 } },
    { axis: "x" as const, direction: -1, solid: { height: 200, width: 1, x: -50, y: -100 } },
    { axis: "y" as const, direction: 1, solid: { height: 1, width: 200, x: -100, y: 50 } },
    { axis: "y" as const, direction: -1, solid: { height: 1, width: 200, x: -100, y: -50 } },
  ])(
    "sweeps a strong push against a thin $axis solid in direction $direction",
    ({ axis, direction, solid }) => {
      const bird = startBird(BIRD, { x: BIRD.width / 2, y: BIRD.height });
      const push = {
        x: axis === "x" ? direction * 100000 : 0,
        y: axis === "y" ? direction * 100000 : 0,
      };
      const stopped = stepBird(BIRD, [solid], [], STEP, { ...IDLE, push }, bird);
      const size = axis === "x" ? "width" : "height";
      expect(stopped[axis]).toBe(
        direction > 0 ? solid[axis] - BIRD[size] : solid[axis] + solid[size],
      );
    },
  );
});
