import type { BirdTuning } from "../data/types";
import { VALIDATION_LIMITS } from "./diagnostics";
import {
  type PreparedStage,
  type RunResult,
  simulateStage,
  type SimulationConfig,
  simulationSeeds,
} from "./simulate";

export interface BatchResult {
  readonly validation: {
    readonly fullPass: boolean;
    readonly passed: number;
    readonly requested: number;
  };
  readonly aggregate: {
    readonly activeSeconds: number;
    readonly budgetExhausted: number;
    readonly cleared: number;
    readonly completionRate: number;
    readonly deaths: number;
    readonly goalReached: number;
    readonly meanPeakProgress: number;
    readonly meanProgress: number;
    readonly retries: number;
    readonly runs: number;
    readonly runtimeMs: number;
    readonly steps: number;
    readonly stepsPerSecond: number;
  };
  readonly omissions: readonly {
    readonly reason: "batch-wall-budget" | "stage-preparation-wall-budget";
    readonly seed: number;
  }[];
  readonly omittedSeeds: readonly number[];
  readonly runs: readonly RunResult[];
}

// Preparation is supplied by the caller, allowing several policies to reuse a layout/index.
export function simulateBatch(
  tuning: BirdTuning,
  prepare: (seed: number) => PreparedStage,
  config: Omit<SimulationConfig, "seed">,
  seeds: readonly number[],
  limits: { readonly maxWallTimeMs?: number } = {},
): BatchResult {
  if (seeds.length === 0) {
    throw new Error("A batch needs explicit seeds");
  }
  if (
    config.skill.navigation?.profile === "validation" &&
    (limits.maxWallTimeMs === undefined || limits.maxWallTimeMs > VALIDATION_LIMITS.batchWallTimeMs)
  ) {
    throw new Error("Validation profile requires a bounded batch wall limit");
  }
  const started = performance.now();
  if (
    limits.maxWallTimeMs !== undefined &&
    (!Number.isFinite(limits.maxWallTimeMs) || limits.maxWallTimeMs <= 0)
  ) {
    throw new Error("Invalid batch wall budget");
  }
  const runs: RunResult[] = [];
  const omittedSeeds: number[] = [];
  const omissions: {
    reason: "batch-wall-budget" | "stage-preparation-wall-budget";
    seed: number;
  }[] = [];
  const omit = (values: readonly number[], reason: (typeof omissions)[number]["reason"]) => {
    omittedSeeds.push(...values);
    omissions.push(...values.map((seed) => ({ reason, seed })));
  };
  for (const [index, seed] of seeds.entries()) {
    if (limits.maxWallTimeMs !== undefined && performance.now() - started >= limits.maxWallTimeMs) {
      omit(seeds.slice(index), "batch-wall-budget");
      break;
    }
    const runConfig = { ...config, seed };
    const stageStarted = performance.now();
    const stage = prepare(simulationSeeds(runConfig).layout);
    const remaining =
      limits.maxWallTimeMs === undefined
        ? undefined
        : limits.maxWallTimeMs - (performance.now() - started);
    if (remaining !== undefined && remaining <= 0) {
      omit(seeds.slice(index), "batch-wall-budget");
      break;
    }
    const stageRemaining =
      config.maxWallTimeMs === undefined
        ? undefined
        : config.maxWallTimeMs - (performance.now() - stageStarted);
    if (stageRemaining !== undefined && stageRemaining <= 0) {
      omit([seed], "stage-preparation-wall-budget");
      continue;
    }
    const executionWall = Math.min(stageRemaining ?? Infinity, remaining ?? Infinity);
    runs.push(
      simulateStage(
        tuning,
        stage,
        Number.isFinite(executionWall) ? { ...runConfig, maxWallTimeMs: executionWall } : runConfig,
      ),
    );
  }
  const sum = (read: (run: RunResult) => number) =>
    runs.reduce((total, run) => total + read(run), 0);
  const steps = sum((run) => run.steps);
  const runtimeMs = performance.now() - started;
  const cleared = runs.filter((run) => run.status === "cleared").length;
  return {
    aggregate: {
      activeSeconds: sum((run) => run.activeSeconds),
      budgetExhausted: runs.filter(
        (run) =>
          run.status === "step-budget" ||
          run.status === "retry-budget" ||
          run.status === "wall-budget" ||
          run.status === "prediction-budget",
      ).length,
      cleared,
      completionRate: runs.length === 0 ? 0 : cleared / runs.length,
      deaths: sum((run) => run.deaths),
      goalReached: runs.filter((run) => run.status === "goal-reached").length,
      meanPeakProgress: runs.length === 0 ? 0 : sum((run) => run.peakProgress) / runs.length,
      meanProgress: runs.length === 0 ? 0 : sum((run) => run.progress) / runs.length,
      retries: sum((run) => run.retries),
      runs: runs.length,
      runtimeMs,
      steps,
      stepsPerSecond: runtimeMs > 0 ? (steps * 1000) / runtimeMs : 0,
    },
    omissions,
    omittedSeeds,
    runs,
    validation: {
      fullPass: runs.length === seeds.length && runs.every((run) => run.fullPass),
      passed: runs.filter((run) => run.fullPass).length,
      requested: seeds.length,
    },
  };
}
