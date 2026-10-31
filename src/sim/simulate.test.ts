import { describe, expect, it, vi } from "vitest";

import { BIRD } from "../data/bird";
import type { AreaLayout, ZoneLayout } from "../data/types";
import { stageProgress } from "../rules/stageProgress";
import { STEP_SECONDS } from "../rules/step";
import * as zoneRules from "../rules/zone";
import { startZone, stepZone } from "../rules/zone";
import { BIRD_FRAME } from "../view/bird";
import * as botRules from "./bot";
import { DIAGNOSTIC_SKILL, FORWARD_POLICY, NAVIGATION_VALIDATION } from "./bot";
import { VALIDATION_LIMITS } from "./diagnostics";
import { simulateBatch } from "./report";
import {
  prepareStage,
  replayCompletionWitness,
  simulateStage,
  type SimulationConfig,
  simulationGoalReached,
  validateSimulation,
} from "./simulate";

function fixture(solids: AreaLayout["solids"], exitX = 1000): ZoneLayout {
  return {
    areas: {
      main: {
        backX: 0,
        chunks: [],
        entries: { start: { x: 60, y: 120 } },
        exitX,
        height: 140,
        objects: [],
        solids,
        terrain: [],
        tileset: undefined,
        width: 1100,
      },
    },
    birdFrame: BIRD_FRAME,
    start: { area: "main", entry: "start" },
  };
}
const config: SimulationConfig = {
  maxRetries: 0,
  maxSteps: 120,
  policy: { jump: "never", move: 1 },
  seed: 7,
  skill: DIAGNOSTIC_SKILL,
};
const ground = [{ height: 20, width: 1100, x: 0, y: 120 }];

function deterministic(result: ReturnType<typeof simulateStage>) {
  return { ...result, runtimeMs: 0 };
}

describe("bounded stage simulation", () => {
  it("matches direct real-rule stepping and stops on completion", () => {
    const layout = fixture(ground, 200);
    let actual = startZone(BIRD, layout, config.seed);
    let steps = 0;
    while (!actual.cleared && steps < config.maxSteps) {
      actual = stepZone(
        BIRD,
        layout,
        STEP_SECONDS,
        { jumpHeld: false, move: 1, useHeld: false },
        actual,
      );
      steps++;
    }
    const run = simulateStage(BIRD, prepareStage(layout), config);
    expect(run.status).toBe("cleared");
    expect(run.steps).toBe(steps);
    expect(run.activeSeconds).toBe(steps * STEP_SECONDS);
    expect(run.progress).toBe(1);
    expect(run.deaths).toBe(0);
  });
  it("reports successful attempt time excluding failed time retained in the run total", () => {
    let ticks = 0;
    const stepping = vi.spyOn(zoneRules, "stepZone").mockImplementation((...args) => {
      const state = args[4];
      ticks++;
      return {
        ...state,
        cleared: ticks === 5,
        death:
          ticks === 2
            ? {
                position: { x: state.bird.x, y: state.bird.y },
                reason: "fall",
                support: undefined,
                velocity: { x: 0, y: 0 },
              }
            : undefined,
      };
    });
    try {
      const stage = prepareStage(fixture(ground));
      const run = simulateStage(BIRD, stage, { ...config, maxRetries: 1, maxSteps: 10 });
      expect(run.status).toBe("cleared");
      expect(run.retries).toBe(1);
      expect(run.activeSeconds).toBe(5 * STEP_SECONDS);
      expect(run.successfulAttemptSeconds).toBe(3 * STEP_SECONDS);
      const exhausted = simulateStage(BIRD, stage, { ...config, maxSteps: 1 });
      expect(exhausted.status).toBe("step-budget");
      expect(exhausted).not.toHaveProperty("successfulAttemptSeconds");
    } finally {
      stepping.mockRestore();
    }
  });
  it("counts real failed attempts and retries without stepping a frozen death", () => {
    const run = simulateStage(BIRD, prepareStage(fixture([])), {
      ...config,
      maxRetries: 2,
      maxSteps: 500,
    });
    expect(run.status).toBe("retry-budget");
    expect(run.retries).toBe(2);
    expect(run.deathsByReason.fall).toBe(3);
    expect(run.steps).toBeLessThan(500);
    expect(run.activeSeconds).toBe(run.steps * STEP_SECONDS);
  });
  it("replays seeded decisions and reports the tick budget without retrying", () => {
    const stage = prepareStage(fixture(ground));
    const options = {
      ...config,
      maxSteps: 30,
      policy: { ...FORWARD_POLICY, jump: "continuous" as const },
      skill: { ...DIAGNOSTIC_SKILL, errorRate: 0.5 },
    };
    const first = simulateStage(BIRD, stage, options);
    expect(deterministic(first)).toEqual(deterministic(simulateStage(BIRD, stage, options)));
    expect(first.status).toBe("step-budget");
    expect(first.steps).toBe(30);
    expect(first.retries).toBe(0);
  });
  it("aggregates explicit bounded runs without losing failures", () => {
    const stage = prepareStage(fixture(ground));
    const report = simulateBatch(BIRD, () => stage, { ...config, maxSteps: 3 }, [1, 2]);
    expect(report.aggregate).toMatchObject({
      budgetExhausted: 2,
      cleared: 0,
      deaths: 0,
      runs: 2,
      steps: 6,
    });
    expect(report.aggregate.activeSeconds).toBe(6 * STEP_SECONDS);
    expect(report.runs.map(({ seed }) => seed)).toEqual([1, 2]);
  });
  it.each([{ maxSteps: Infinity }, { maxSteps: 0 }, { maxRetries: -1 }, { seed: NaN }])(
    "rejects unbounded or invalid budgets: %j",
    (invalid) => {
      expect(() =>
        simulateStage(BIRD, prepareStage(fixture(ground)), { ...config, ...invalid }),
      ).toThrow();
    },
  );
});

describe("simulation sections and diagnostics", () => {
  it("caps per-attempt death events and reports dropped diagnostics", () => {
    const run = simulateStage(BIRD, prepareStage(fixture([])), {
      ...config,
      maxRetries: 2,
      maxSteps: 500,
      trace: { maxEvents: 2, stallTicks: 10 },
    });
    expect(run.trace.map(({ attempt, kind }) => [attempt, kind])).toEqual([
      [0, "death"],
      [1, "death"],
    ]);
    expect(run.traceDropped).toBe(1);
    expect(run.trace[0]).toMatchObject({ deathReason: "fall", input: { move: 1 } });
  });
  it("diagnoses blocked movement without recording unbounded per-tick samples", () => {
    const stage = prepareStage(fixture([...ground, { height: 120, width: 12, x: 90, y: 0 }]));
    const run = simulateStage(BIRD, stage, { ...config, trace: { maxEvents: 3, stallTicks: 10 } });
    expect(run.trace).toHaveLength(3);
    expect(run.trace.every(({ kind, x, y }) => kind === "stall" && x === 66 && y === 84)).toBe(
      true,
    );
    expect(run.traceDropped).toBeGreaterThan(0);
  });
  it("starts from a validated section and rejects an embedded or out-of-bounds start", () => {
    const stage = prepareStage(fixture(ground));
    const start = { area: "main", x: 400, y: 84 };
    const run = simulateStage(BIRD, stage, { ...config, maxSteps: 1, start });
    expect(run.start).toEqual(start);
    const checkpoint = startZone(BIRD, stage.layout, config.seed);
    const absolute = stageProgress(BIRD, stage.layout, {
      ...checkpoint,
      bird: { ...checkpoint.bird, x: start.x, y: start.y },
    });
    expect(run.progress).toBeCloseTo(absolute, 2);
    for (const invalid of [
      { ...start, y: 110 },
      { ...start, x: -1 },
    ]) {
      expect(() => simulateStage(BIRD, stage, { ...config, start: invalid })).toThrow();
    }
  });
  it("resolves independent seeds and uses the layout seed only for preparation", () => {
    const requested: number[] = [];
    const stage = prepareStage(fixture(ground));
    const report = simulateBatch(
      BIRD,
      (seed) => {
        requested.push(seed);
        return stage;
      },
      { ...config, maxSteps: 1, seeds: { bot: 23, layout: 19, motion: 29 } },
      [3],
    );
    expect(requested).toEqual([19]);
    expect(report.runs[0]?.seeds).toEqual({ bot: 23, layout: 19, motion: 29 });
  });
});

describe("bounded section goals and reproducibility", () => {
  it("recognizes an area-local goal crossed before a forward stair transition", () => {
    const original = fixture(ground);
    const main = original.areas.main;
    if (!main) {
      throw new Error("Missing fixture area");
    }
    const layout = {
      ...original,
      areaOrder: ["main", "upper"],
      areas: {
        main: { ...main, walkLinks: { right: { area: "upper", entry: "start" } } },
        upper: { ...main, walkLinks: { left: { area: "main", entry: "start" } } },
      },
    };
    const initial = startZone(BIRD, layout, config.seed);
    const before = {
      ...initial,
      bird: { ...initial.bird, grounded: true, vx: BIRD.walkSpeed, x: main.exitX - BIRD.width - 1 },
    };
    const after = { ...initial, area: "upper" };
    const goal = { area: "main", x: main.exitX };
    expect(simulationGoalReached(BIRD, layout, 1, goal, before, after)).toBe(true);
    expect(simulationGoalReached(BIRD, layout, 1, goal, before, before)).toBe(false);
    expect(simulationGoalReached(BIRD, layout, -1, goal, before, after)).toBe(false);
  });
  it("reports section success independently of stage completion and joins chunk IDs", () => {
    const layout = fixture(ground);
    const main = layout.areas.main;
    if (!main) {
      throw new Error("Missing fixture area");
    }
    const stage = {
      ...prepareStage({ ...layout, areas: { main: { ...main, chunks: [{ width: 1100, x: 0 }] } } }),
      source: { chunkIds: { main: ["fixture-section"] }, layoutSeed: config.seed },
    };
    const run = simulateStage(BIRD, stage, {
      ...config,
      goal: { area: "main", x: 200 },
      trace: { maxEvents: 1, sampleEveryTicks: 1, stallTicks: 10 },
    });
    expect(run.status).toBe("goal-reached");
    expect(run.progress).toBeLessThan(1);
    expect(run.trace[0]?.chunkId).toBe("fixture-section");
    expect(() => simulateStage(BIRD, stage, { ...config, goal: { area: "main", x: 10 } })).toThrow(
      "Invalid section goal",
    );
    expect(() => simulateStage(BIRD, stage, { ...config, seeds: { layout: 99 } })).toThrow(
      "Prepared layout seed",
    );
  });
  it("repeats one bot seed and changes actual inputs with an independent bot seed", () => {
    const stage = prepareStage(fixture(ground));
    const play = (bot: number) =>
      simulateStage(BIRD, stage, {
        ...config,
        maxSteps: 60,
        policy: { jump: "continuous", move: 1 },
        seeds: { bot, layout: 1, motion: 2 },
        skill: { ...DIAGNOSTIC_SKILL, errorRate: 0.5 },
        trace: { maxEvents: 60, sampleEveryTicks: 1, stallTicks: 120 },
      }).trace.map(({ input, x, y }) => ({ input, x, y }));
    expect(play(10)).toEqual(play(10));
    expect(play(10)).not.toEqual(play(11));
  });
});

describe("terminal diagnostic budgets and coverage", () => {
  it("stops a blocked policy independently of a full or absent trace", () => {
    const stage = prepareStage(fixture([...ground, { height: 120, width: 12, x: 90, y: 0 }]));
    for (const trace of [undefined, { maxEvents: 1, stallTicks: 2 }]) {
      const run = simulateStage(BIRD, stage, {
        ...config,
        maxSteps: 100,
        stopAfterStallTicks: 10,
        ...(trace ? { trace } : {}),
      });
      expect(run.status).toBe("policy-stall");
      expect(run.steps).toBeLessThan(100);
      expect(run.coverage.areasVisited).toEqual(["main"]);
      expect(run.lastAttemptSeconds).toBe(run.activeSeconds);
    }
  });
  it("omits undispatched seeds after preparation spends the batch wall budget", () => {
    const clock = vi.spyOn(performance, "now");
    let now = 0;
    clock.mockImplementation(() => now);
    try {
      const report = simulateBatch(
        BIRD,
        () => {
          now += 20;
          return prepareStage(fixture(ground));
        },
        config,
        [1, 2],
        { maxWallTimeMs: 10 },
      );
      expect(report.runs).toEqual([]);
      expect(report.omittedSeeds).toEqual([1, 2]);
      expect(report.aggregate.completionRate).toBe(0);
    } finally {
      clock.mockRestore();
    }
  });
  it("reports a wall limit separately from physics and policy failures", () => {
    const clock = vi.spyOn(performance, "now");
    let now = 0;
    clock.mockImplementation(() => now++);
    try {
      const run = simulateStage(BIRD, prepareStage(fixture(ground)), {
        ...config,
        maxWallTimeMs: 3,
      });
      expect(run.status).toBe("wall-budget");
      expect(run.steps).toBeLessThan(config.maxSteps);
      expect(run.activeSeconds).toBe(run.steps * STEP_SECONDS);
      expect(run).not.toHaveProperty("successfulAttemptSeconds");
    } finally {
      clock.mockRestore();
    }
  });
});

it("retains the run prediction budget across retry reseeding", () => {
  const budgets: number[] = [];
  let ticks = 0;
  const input = vi.spyOn(botRules, "botInput").mockImplementation((_t, _s, _l, skill) => {
    budgets.push(skill.navigation?.maxPhysicsSteps ?? -1);
    return { jumpHeld: false, move: 1, useHeld: false };
  });
  const counters = vi
    .spyOn(botRules, "navigationCounters")
    .mockReturnValue({ budgetExhaustions: 0, candidateRollouts: 1, decisions: 1, physicsSteps: 3 });
  const step = vi.spyOn(zoneRules, "stepZone").mockImplementation((...args) => {
    ticks++;
    const state = args[4];
    return {
      ...state,
      cleared: ticks === 2,
      death:
        ticks === 1
          ? {
              position: { x: state.bird.x, y: state.bird.y },
              reason: "fall",
              support: undefined,
              velocity: { x: 0, y: 0 },
            }
          : undefined,
    };
  });
  try {
    const run = simulateStage(BIRD, prepareStage(fixture(ground)), {
      ...config,
      maxRetries: 1,
      policy: { jump: "planned", move: 1 },
      skill: { ...DIAGNOSTIC_SKILL, navigation: { maxPhysicsSteps: 6 } },
    });
    expect(budgets).toEqual([6, 3]);
    expect(run.planning.physicsSteps).toBe(6);
    expect(run.status).toBe("cleared");
    expect(run.successfulAttemptSeconds).toBe(STEP_SECONDS);
  } finally {
    input.mockRestore();
    counters.mockRestore();
    step.mockRestore();
  }
});

it("records actual linked-area and chunk coverage independently of trace sampling", () => {
  const base = fixture(ground, 200);
  const main = base.areas.main!;
  const stage = {
    ...prepareStage({
      ...base,
      areaOrder: ["main", "upper"],
      areas: {
        main: {
          ...main,
          chunks: [{ width: 1100, x: 0 }],
          walkLinks: { right: { area: "upper", entry: "start" } },
        },
        upper: {
          ...main,
          chunks: [{ width: 1100, x: 0 }],
          walkLinks: { left: { area: "main", entry: "start" } },
        },
      },
    }),
    source: { chunkIds: { main: ["lower-fixture"], upper: ["upper-fixture"] } },
  };
  const run = simulateStage(BIRD, stage, { ...config, maxSteps: 300 });
  expect(run.status).toBe("cleared");
  expect(run.coverage).toMatchObject({
    areaTransitions: 1,
    areasVisited: ["main", "upper"],
    chunksVisited: {
      main: [{ id: "lower-fixture", index: 0 }],
      upper: [{ id: "upper-fixture", index: 0 }],
    },
  });
});

it("reports zero prediction allowance before exhausting real ticks on a frozen policy", () => {
  const run = simulateStage(BIRD, prepareStage(fixture(ground)), {
    ...config,
    policy: { jump: "planned", move: 1 },
    skill: { ...DIAGNOSTIC_SKILL, navigation: { maxPhysicsSteps: 0 } },
  });
  expect(run.status).toBe("prediction-budget");
  expect(run.planning.physicsSteps).toBe(0);
  expect(run.steps).toBeLessThan(config.maxSteps);
  expect(run.successfulAttemptSeconds).toBeUndefined();
});

describe("whole-stage input witnesses", () => {
  const options: SimulationConfig = {
    ...config,
    maxSteps: 300,
    provenance: { build: "synthetic-source", data: "synthetic-data", stage: "fixture" },
    witness: { maxSegments: 300 },
  };
  it("replays recorded actual inputs to an explicit whole-stage clear", () => {
    const stage = prepareStage(fixture(ground, 200));
    const run = simulateStage(BIRD, stage, options);
    expect(run.fullPass).toBe(true);
    expect(run.witness?.truncated).toBe(false);
    const replay = replayCompletionWitness(
      BIRD,
      stage,
      options,
      { maxSteps: 300, maxWallTimeMs: 1000 },
      run.witness!,
    );
    expect(replay.status).toBe("verified");
    expect(replay.executedSteps).toBe(run.steps);
    expect(run.coverage.path).toHaveLength(1);
    expect(run.terminal.kind).toBe("terminal");
  });
  it("rejects a recording that exceeds its claimed original execution budget without stepping", () => {
    const stage = prepareStage(fixture(ground, 200));
    const run = simulateStage(BIRD, stage, options);
    const reduced = { ...options, maxSteps: 1, witness: { maxSegments: 1 } };
    expect(run.steps).toBeGreaterThan(reduced.maxSteps);
    const replay = replayCompletionWitness(
      BIRD,
      stage,
      reduced,
      { maxSteps: 300, maxWallTimeMs: 1000 },
      { ...run.witness!, config: reduced },
    );
    expect(replay.status).toBe("mismatch");
    expect(replay.executedSteps).toBe(0);
  });
  it("replays a valid witness whose source identifier comes from the prepared stage", () => {
    const stage = {
      ...prepareStage(fixture(ground, 200)),
      source: { provenance: { build: "prepared-source" } },
    };
    const supplied = { ...options, provenance: { data: "synthetic-data" } };
    const run = simulateStage(BIRD, stage, supplied);
    expect(run.fullPass).toBe(true);
    expect(run.witness?.provenance.build).toBe("prepared-source");
    const replay = replayCompletionWitness(
      BIRD,
      stage,
      supplied,
      { maxSteps: 300, maxWallTimeMs: 1000 },
      run.witness!,
    );
    expect(replay.status).toBe("verified");
    expect(replay.executedSteps).toBe(run.steps);
  });
  it("rejects wrong prepared context, source/config and tampered input counts", () => {
    const stage = prepareStage(fixture(ground, 200));
    const run = simulateStage(BIRD, stage, options);
    const witness = run.witness!;
    const limits = { maxSteps: 300, maxWallTimeMs: 1000 };
    for (const [prepared, expected, recording] of [
      [prepareStage(fixture(ground, 240)), options, witness],
      [stage, { ...options, seed: 8 }, witness],
      [
        stage,
        { ...options, provenance: { ...options.provenance, build: "different-source" } },
        witness,
      ],
      [
        stage,
        options,
        {
          ...witness,
          segments: witness.segments.map((segment, index) => ({
            ...segment,
            ticks: segment.ticks + (index === 0 ? 1 : 0),
          })),
        },
      ],
    ] as const) {
      const replay = replayCompletionWitness(BIRD, prepared, expected, limits, recording);
      expect(replay.status).toBe("mismatch");
      expect(replay.executedSteps).toBe(0);
    }
  });
  it("does not accept scoped goals, cold starts, death or truncated recordings as full passes", () => {
    const stage = prepareStage(fixture(ground, 200));
    const goal = simulateStage(BIRD, stage, { ...options, goal: { area: "main", x: 150 } });
    expect(goal.status).toBe("goal-reached");
    expect(goal.fullPass).toBe(false);
    expect(
      simulateStage(BIRD, stage, { ...options, start: { area: "main", x: 100, y: 84 } }).fullPass,
    ).toBe(false);
    const dead = simulateStage(BIRD, prepareStage(fixture([])), options);
    expect(dead.fullPass).toBe(false);
    expect(dead.failures).toHaveLength(1);
    expect(dead.terminal.deathReason).toBe("fall");
    const truncated = simulateStage(BIRD, stage, {
      ...options,
      policy: { jump: "continuous", move: 1 },
      skill: { ...DIAGNOSTIC_SKILL, errorRate: 0.5 },
      witness: { maxSegments: 1 },
    });
    expect(truncated.witness?.truncated).toBe(true);
    expect(truncated.fullPass).toBe(false);
  });
  it("requires every requested run to have a whole-stage witness", () => {
    const stage = prepareStage(fixture(ground, 200));
    const report = simulateBatch(BIRD, () => stage, options, [1, 2]);
    expect(report.validation).toEqual({ fullPass: true, passed: 2, requested: 2 });
    const partial = simulateBatch(
      BIRD,
      () => stage,
      { ...options, maxSteps: 1, witness: { maxSegments: 1 } },
      [1, 2],
    );
    expect(partial.validation).toEqual({ fullPass: false, passed: 0, requested: 2 });
  });
  it("preserves retry boundaries and counts verifier work after an altered replay", () => {
    const realStep = zoneRules.stepZone;
    let inject = true;
    const stepping = vi.spyOn(zoneRules, "stepZone").mockImplementation((...args) => {
      if (inject) {
        inject = false;
        const state = args[4];
        return {
          ...state,
          death: {
            position: { x: state.bird.x, y: state.bird.y },
            reason: "fall",
            support: undefined,
            velocity: { x: 0, y: 0 },
          },
        };
      }
      return realStep(...args);
    });
    try {
      const stage = prepareStage(fixture(ground, 200));
      const retryOptions = { ...options, maxRetries: 1 };
      const run = simulateStage(BIRD, stage, retryOptions);
      expect(run.fullPass).toBe(true);
      expect(run.witness?.segments.map((s) => s.attempt)).toEqual([0, 1]);
      inject = true;
      const replay = replayCompletionWitness(
        BIRD,
        stage,
        retryOptions,
        { maxSteps: 300, maxWallTimeMs: 1000 },
        run.witness!,
      );
      expect(replay.status).toBe("verified");
      expect(replay.executedSteps).toBe(run.steps);
      inject = true;
      const altered = {
        ...run.witness!,
        segments: run.witness!.segments.map((s) => ({
          ...s,
          input: { ...s.input, move: 0 as const },
        })),
      };
      const mismatch = replayCompletionWitness(
        BIRD,
        stage,
        retryOptions,
        { maxSteps: 300, maxWallTimeMs: 1000 },
        altered,
      );
      expect(mismatch.status).toBe("mismatch");
      expect(mismatch.executedSteps).toBeGreaterThan(0);
    } finally {
      stepping.mockRestore();
    }
  });
});

describe("explicit validation profile and actual failure memory", () => {
  const validation: SimulationConfig = {
    ...config,
    maxRetries: VALIDATION_LIMITS.maxRetries,
    maxSteps: VALIDATION_LIMITS.maxSteps,
    maxWallTimeMs: VALIDATION_LIMITS.maxWallTimeMs,
    skill: { ...DIAGNOSTIC_SKILL, navigation: NAVIGATION_VALIDATION },
    stopAfterStallTicks: VALIDATION_LIMITS.stopAfterStallTicks,
  };
  it("admits only the explicit validation profile within its execution and planning limits", () => {
    expect(() => validateSimulation(validation)).not.toThrow();
    expect(() =>
      validateSimulation({ ...validation, maxSteps: VALIDATION_LIMITS.maxSteps + 1 }),
    ).toThrow("execution limits");
    expect(() =>
      validateSimulation({
        ...validation,
        skill: { ...validation.skill, navigation: { ...NAVIGATION_VALIDATION, profile: "quick" } },
      }),
    ).toThrow("navigation maxPhysicsSteps");
    expect(() =>
      simulateBatch(BIRD, () => prepareStage(fixture(ground)), validation, [1], {
        maxWallTimeMs: VALIDATION_LIMITS.batchWallTimeMs + 1,
      }),
    ).toThrow("batch wall limit");
  });
  it("transfers only actual death memory across reseeded retries and never consults it during replay", () => {
    const realStep = zoneRules.stepZone;
    let inject = true;
    const step = vi.spyOn(zoneRules, "stepZone").mockImplementation((...args) => {
      if (inject) {
        inject = false;
        const state = args[4];
        return {
          ...state,
          death: {
            position: { x: state.bird.x, y: state.bird.y },
            reason: "fall",
            support: undefined,
            velocity: { x: 0, y: 0 },
          },
        };
      }
      return realStep(...args);
    });
    const remember = vi.spyOn(botRules, "rememberNavigationFailure");
    const restore = vi.spyOn(botRules, "restoreNavigationMemory");
    try {
      const stage = prepareStage(fixture(ground, 200));
      const options: SimulationConfig = {
        ...config,
        maxRetries: 1,
        maxSteps: 300,
        provenance: { build: "fixture-memory" },
        witness: { maxSegments: 300 },
      };
      const run = simulateStage(BIRD, stage, options);
      expect(run.fullPass).toBe(true);
      expect(remember).toHaveBeenCalledTimes(1);
      expect(restore).toHaveBeenCalledTimes(1);
      expect(restore.mock.calls[0]?.[0].deaths).toHaveLength(1);
      inject = true;
      const replay = replayCompletionWitness(
        BIRD,
        stage,
        options,
        { maxSteps: 300, maxWallTimeMs: 1000 },
        run.witness!,
      );
      expect(replay.status).toBe("verified");
      expect(remember).toHaveBeenCalledTimes(1);
      expect(restore).toHaveBeenCalledTimes(1);
      simulateStage(BIRD, stage, options);
      expect(restore).toHaveBeenCalledTimes(1);
    } finally {
      step.mockRestore();
      remember.mockRestore();
      restore.mockRestore();
    }
  });
});
