import { describe, expect, it, vi } from "vitest";

import { BIRD } from "../data/bird";
import type { AreaLayout, ZoneLayout } from "../data/types";
import { stageProgress } from "../rules/stageProgress";
import { STEP_SECONDS } from "../rules/step";
import * as zoneRules from "../rules/zone";
import { startZone, stepZone } from "../rules/zone";
import { BIRD_FRAME } from "../view/bird";
import { DIAGNOSTIC_SKILL, FORWARD_POLICY } from "./bot";
import { simulateBatch } from "./report";
import {
  prepareStage,
  simulateStage,
  type SimulationConfig,
  simulationGoalReached,
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
