import { fillNames } from "@andornaut/game-kit/lines";

import type { StatsText } from "../../data/types";

export interface WholeRunStatsSummary {
  readonly activeSeconds: number;
  readonly deaths: number;
}

export interface WholeRunDisplaySummary extends WholeRunStatsSummary {
  readonly completed: number;
  readonly total: number;
}

export function wholeRunSummary(
  stages: readonly string[],
  completed: readonly string[],
  counters: WholeRunStatsSummary,
): WholeRunDisplaySummary {
  const catalogue = new Set(stages),
    cleared = new Set(completed);
  return {
    ...counters,
    completed: [...catalogue].filter((id) => cleared.has(id)).length,
    total: catalogue.size,
  };
}

export interface RunCounters {
  readonly attemptSeconds: number;
  readonly attempts: number;
  readonly runSeconds: number;
}

export interface RunStatsSummary extends RunCounters {
  readonly cumulativeSeconds?: number;
  readonly bestSeconds: number | undefined;
}

export interface ZoneStatsSummary extends RunStatsSummary {
  readonly completed: number;
  readonly partial: boolean;
  readonly total: number;
}

// Aggregate only the runs explicitly supplied by the current visit.
export function runSummary(
  bestSeconds: number | undefined,
  runs: readonly RunCounters[],
): RunStatsSummary {
  return runs.reduce<RunStatsSummary>(
    (sum, run) => ({
      attemptSeconds: sum.attemptSeconds + run.attemptSeconds,
      attempts: sum.attempts + run.attempts,
      bestSeconds,
      runSeconds: sum.runSeconds + run.runSeconds,
    }),
    { attemptSeconds: 0, attempts: 0, bestSeconds, runSeconds: 0 },
  );
}

export function timeText(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function formatWholeRunStats(template: string, summary: WholeRunDisplaySummary): string {
  return fillNames(template, {
    completed: String(summary.completed),
    deaths: String(summary.deaths),
    time: timeText(summary.activeSeconds),
    total: String(summary.total),
  });
}

export function formatRunStats(words: StatsText, summary: RunStatsSummary) {
  return {
    attempts: fillNames(words.attempts, { count: String(summary.attempts) }),
    best: fillNames(words.best, {
      time: summary.bestSeconds === undefined ? words.notCleared : timeText(summary.bestSeconds),
    }),
    lastAttempt: fillNames(words.lastAttempt, { time: timeText(summary.attemptSeconds) }),
    runTotal: fillNames(words.runTotal, { time: timeText(summary.runSeconds) }),
  };
}
