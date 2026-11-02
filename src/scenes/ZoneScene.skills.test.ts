import { frameSteps, startStepClock } from "@andornaut/game-kit/clock/fixedStep";
import { afterEach, expect, it, vi } from "vitest";

import { BIRD } from "../data/bird";
import { SKILLS } from "../data/skills";
import type { SkillId } from "../data/types";
import { startBird } from "../rules/bird";
import { STEP_MS } from "../rules/step";
import * as engine from "../rules/zone";

const saved = vi.hoisted(() => ({ active: null as SkillId | null }));
vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../input/frameTurn", () => ({ FRAME_TURN: {} }));
vi.mock("../dev/mode", () => ({
  developmentSkillOverrides: () => ({}),
  invulnerabilityEnabled: () => false,
  isDevelopmentSession: () => false,
}));
vi.mock("../save", () => ({ activeSkill: () => saved.active, recordActiveStageStep: vi.fn() }));

import { ZoneScene } from "./ZoneScene";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each<SkillId | null>([null, "dash", "doubleJump", "speedy"])(
  "passes only selected %s to actual world physics",
  (selected) => {
    vi.stubGlobal("window", { location: { search: "" } });
    saved.active = selected;
    const world = {
      area: "main",
      bird: startBird(BIRD, { x: 0, y: 0 }),
      steps: 0,
    } as engine.ZoneState;
    const step = vi
      .spyOn(engine, "stepZone")
      .mockImplementation((_tuning, _layout, _seconds, _input, state) => ({
        ...state,
        death: {
          position: { x: 0, y: 0 },
          reason: "fall",
          support: undefined,
          velocity: { x: 0, y: 0 },
        },
        steps: state.steps + 1,
      }));
    const scene = Object.assign(new ZoneScene(), {
      beginDeath(this: { dying: unknown }) {
        this.dying = {};
      },
      clock: frameSteps({ maxFrameMs: 100, stepMs: STEP_MS }, 0, startStepClock).clock,
      drawDeath: vi.fn(),
      layout: {},
      loading: false,
      openProximityDialogue: () => false,
      stageKey: () => "stage",
      zone: world,
    }) as unknown as { update(time: number): void };
    scene.update(STEP_MS * 2);
    expect(step).toHaveBeenCalledOnce();
    const profile = step.mock.calls[0]![0];
    expect(profile.doubleJump).toBe(selected === "doubleJump");
    expect(profile.dash).toEqual(selected === "dash" ? BIRD.dash : undefined);
    expect(profile.walkSpeed).toBe(
      BIRD.walkSpeed * (selected === "speedy" ? SKILLS.speedyWalkMultiplier : 1),
    );
    expect(profile.jumpSpeed).toBe(BIRD.jumpSpeed);
  },
);
