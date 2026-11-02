import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { SKILLS } from "../data/skills";
import { startBird, stepBird } from "./bird";
import { skillTuning } from "./skills";
import { STEP_SECONDS } from "./step";

const idle = { jumpHeld: false, move: 0 } as const;
it("cancels a deselected dash before movement without refunding cooldown or its airborne use", () => {
  const dash = skillTuning(SKILLS, "dash", BIRD),
    off = skillTuning(SKILLS, "speedy", BIRD);
  let bird = stepBird(
    dash,
    [],
    [],
    STEP_SECONDS,
    { ...idle, dashPressed: true },
    startBird(dash, { x: 0, y: 100 }),
  );
  const before = bird;
  bird = stepBird(off, [], [], STEP_SECONDS, idle, bird);
  expect(bird.x).toBe(before.x);
  expect(bird.dash?.remainingSeconds).toBe(0);
  expect(bird.dash?.cooldownRemainingSeconds).toBeCloseTo(
    before.dash!.cooldownRemainingSeconds - STEP_SECONDS,
  );
  expect(bird.dash?.airUsed).toBe(true);
  bird = { ...bird, dash: { ...bird.dash!, cooldownRemainingSeconds: 0 } };
  bird = stepBird(dash, [], [], STEP_SECONDS, { ...idle, dashPressed: true }, bird);
  expect(bird.dash?.remainingSeconds).toBe(0);
  expect(bird.dash?.airUsed).toBe(true);
});
it("retains spent extra jumps across selection changes and restores air uses only on actual landing", () => {
  const jump = skillTuning(SKILLS, "doubleJump", BIRD),
    off = skillTuning(SKILLS, "speedy", BIRD);
  let bird = stepBird(
    jump,
    [],
    [],
    STEP_SECONDS,
    { ...idle, jumpHeld: true },
    startBird(jump, { x: 0, y: 100 }),
  );
  expect(bird.airJumpUsed).toBe(true);
  bird = stepBird(off, [], [], STEP_SECONDS, idle, bird);
  const expected = stepBird(off, [], [], STEP_SECONDS, { ...idle, jumpHeld: true }, bird);
  bird = stepBird(jump, [], [], STEP_SECONDS, { ...idle, jumpHeld: true }, bird);
  expect(bird.airJumpUsed).toBe(true);
  expect(bird.vy).toBe(expected.vy);
  const floor = { height: 40, width: 2000, x: -1000, y: 300 };
  bird = {
    ...startBird(off, { x: 0, y: floor.y - 0.1 }),
    airJumpUsed: true,
    dash: {
      airUsed: true,
      cooldownRemainingSeconds: 0,
      direction: 1,
      ordinaryVx: 0,
      remainingSeconds: 0,
    },
    vy: 100,
  };
  bird = stepBird(off, [floor], [], STEP_SECONDS, idle, bird);
  expect(bird.grounded).toBe(true);
  expect(bird.airJumpUsed).toBe(false);
  expect(bird.dash?.airUsed).toBe(false);
});
