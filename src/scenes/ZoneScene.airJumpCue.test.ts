import { frameSteps, startStepClock } from "@andornaut/game-kit/clock/fixedStep";
import { afterEach, expect, it, vi } from "vitest";

import { STEP_MS, STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { startBird, stepBird } from "../rules/bird";
import * as engine from "../rules/zone";

vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../ui/input/frameTurn", () => ({ FRAME_TURN: {} }));
vi.mock("../dev/mode", () => ({
  developmentSkillOverrides: () => ({}),
  invulnerabilityEnabled: () => false,
  isDevelopmentSession: () => false,
}));
vi.mock("./save", () => ({
  activeSkill: () => "doubleJump",
  recordActiveStageStep: vi.fn(),
  recordStepAchievements: vi.fn(),
}));

import { ZoneScene } from "./ZoneScene";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["accepted", "death", "area"])(
  "advances the cue only after an actual surviving same-area step: %s",
  (outcome) => {
    vi.stubGlobal("window", { location: { search: "" } });
    const before = startBird(BIRD, { x: 200, y: 200 });
    const after = stepBird(BIRD, [], [], STEP_SECONDS, { jumpHeld: true, move: 0 }, before);
    const world = { area: "main", attempt: 0, bird: before, steps: 0 } as engine.ZoneState;
    vi.spyOn(engine, "stepZone").mockImplementation(
      (_skillProfiles, _tuning, _layout, _seconds, _input, state) => ({
        ...state,
        area: outcome === "area" ? "next" : "main",
        bird: after,
        death:
          outcome === "death"
            ? {
                position: { x: after.x, y: after.y },
                reason: "fall",
                support: undefined,
                velocity: { x: 0, y: 0 },
              }
            : undefined,
        steps: state.steps + 1,
      }),
    );
    const cue = { clear: vi.fn(), step: vi.fn() };
    const scene = Object.assign(new ZoneScene(), {
      airCue: cue,
      areaShown: "main",
      attemptShown: 0,
      barksCanPresent: () => false,
      beginDeath: vi.fn(),
      clock: frameSteps({ maxFrameMs: 100, stepMs: STEP_MS }, 0, startStepClock).clock,
      drawArea: vi.fn(),
      drawBird: vi.fn(),
      drawControls: vi.fn(),
      drawMoveHint: vi.fn(),
      drawObjects: vi.fn(),
      drawProgress: vi.fn(),
      layout: {},
      loading: false,
      openProximityDialogue: () => false,
      stageKey: () => "stage",
      zone: world,
    }) as unknown as { update(time: number): void };
    scene.update(STEP_MS);
    expect(engine.stepZone).toHaveBeenCalledOnce();
    if (outcome === "accepted") {
      expect(cue.step).toHaveBeenCalledExactlyOnceWith(STEP_SECONDS, before, after);
    } else {
      expect(cue.step).not.toHaveBeenCalled();
    }
  },
);
