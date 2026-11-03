import { expect, it } from "vitest";

import { BIRD } from "../data/bird";
import { SKILLS } from "../data/skills";
import { startBird, stepBird } from "./bird";
import { ordinaryTransitControl } from "./forcedTransitProfile";
import { skillTuning } from "./skills";
import { STEP_SECONDS } from "./step";

const ground = { height: 40, width: 2000, x: -1000, y: 300 };
const idle = { jumpHeld: false, move: 0 as const };
const right = { jumpHeld: false, move: 1 as const };

it("admits the actual Speedy velocity while ordinary input changes back to the base profile", () => {
  const speedy = skillTuning(SKILLS, "speedy", BIRD);
  const base = skillTuning(SKILLS, null, BIRD);
  let bird = stepBird(
    speedy,
    [ground],
    [],
    STEP_SECONDS,
    idle,
    startBird(speedy, { x: 0, y: ground.y }),
  );
  for (let tick = 0; tick < 20; tick++) {
    bird = stepBird(speedy, [ground], [], STEP_SECONDS, right, bird);
  }
  expect(bird.vx).toBe(speedy.walkSpeed);
  expect(ordinaryTransitControl(speedy, bird)).toBe(true);
  expect(ordinaryTransitControl(base, bird)).toBe(true);
  bird = stepBird(base, [ground], [], STEP_SECONDS, right, bird);
  expect(bird.vx).toBeGreaterThan(base.walkSpeed);
  expect(ordinaryTransitControl(base, bird)).toBe(true);
});

it("rejects tuning outside the certified ordinary profile domain even at rest", () => {
  const base = skillTuning(SKILLS, null, BIRD);
  const bird = stepBird(
    base,
    [ground],
    [],
    STEP_SECONDS,
    idle,
    startBird(base, { x: 0, y: ground.y }),
  );
  expect(ordinaryTransitControl(base, bird)).toBe(true);
  expect(ordinaryTransitControl({ ...base, walkSpeed: base.walkSpeed + 1 }, bird)).toBe(false);
  expect(ordinaryTransitControl({ ...base, gravity: base.gravity + 1 }, bird)).toBe(false);
});
