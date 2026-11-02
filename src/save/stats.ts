import type { SaveStorage } from "@andornaut/game-kit/save/contracts";
import { saveStore } from "@andornaut/game-kit/save/saveStore";
import type { Checked, SaveFormat, StoredObject } from "@andornaut/game-kit/save/versionedSave";

import type { MapDestination } from "../data/types";
import {
  type RunCounters,
  type RunStatsSummary,
  runSummary,
  type ZoneStatsSummary,
} from "./runSummary";

export type { RunStatsSummary, ZoneStatsSummary } from "./runSummary";

export interface StageRun extends RunCounters {
  readonly completed: boolean;
}
export interface StageStats {
  readonly bestSeconds?: number;
  readonly run?: StageRun;
}
interface ZoneVisit {
  readonly stages: Readonly<Record<string, StageRun>>;
  readonly zone: string;
}
export interface Stats {
  readonly stages: Readonly<Record<string, StageStats>>;
  readonly visit?: ZoneVisit;
  readonly zones: Readonly<Record<string, number>>;
}

export const STATS_VERSION = 5;
const KEYS = {
  backup: "chibis-way-home.stats-backup",
  save: "chibis-way-home.stats",
} as const;
// A dirty clock is checkpointed at most once per second between lifecycle flushes.
const CHECKPOINT_MS = 1000;
const fresh = (): Stats => ({ stages: {}, zones: {} });

type Destinations = readonly Pick<MapDestination, "id" | "stages">[];
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const duration = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const validRun = (value: unknown): value is StageRun =>
  record(value) &&
  duration(value.attemptSeconds) &&
  duration(value.runSeconds) &&
  value.attemptSeconds <= value.runSeconds &&
  Number.isSafeInteger(value.attempts) &&
  (value.attempts as number) >= 1 &&
  typeof value.completed === "boolean";

export function statsFormat(
  stages: ReadonlySet<string>,
  destinations: Destinations = [],
): SaveFormat<Stats> {
  const checked = (value: unknown): Checked<Stats> => {
    if (!record(value) || !record(value.stages) || !record(value.zones)) {
      return { ok: false, reason: "stats are not records" };
    }
    for (const [key, stage] of Object.entries(value.stages)) {
      if (
        !stages.has(key) ||
        !record(stage) ||
        (stage.bestSeconds !== undefined && !duration(stage.bestSeconds)) ||
        (stage.run !== undefined && !validRun(stage.run))
      ) {
        return { ok: false, reason: "stats contain an unknown stage or invalid run" };
      }
    }
    for (const [zone, seconds] of Object.entries(value.zones)) {
      if (!destinations.some(({ id }) => id === zone) || !duration(seconds)) {
        return { ok: false, reason: "stats contain an unknown zone or invalid best" };
      }
    }
    if (value.visit !== undefined) {
      const visit = value.visit;
      const destination = record(visit) && destinations.find(({ id }) => id === visit.zone);
      if (
        !destination ||
        !record(visit) ||
        !record(visit.stages) ||
        Object.entries(visit.stages).some(
          ([id, run]) => !destination.stages.includes(id) || !validRun(run),
        )
      ) {
        return { ok: false, reason: "stats contain an invalid zone visit" };
      }
    }
    return { ok: true, value: value as unknown as Stats };
  };
  return {
    decode: checked,
    encode: (stats): Checked<StoredObject> => {
      const result = checked(stats);
      return result.ok ? { ok: true, value: { ...result.value } } : result;
    },
    fresh,
    migrations: {},
    version: STATS_VERSION,
  };
}

export interface StageStatsStore {
  beginVisit(zone: string): void;
  beginRun(stage: string): void;
  completeStage(stage: string): RunStatsSummary;
  retryStage(stage: string): void;
  summary(stage: string): RunStatsSummary;
  visitSummary(zone: string): ZoneStatsSummary;
  addActiveTime(stage: string, seconds: number): void;
  clearStage(stage: string): void;
  flush(): Promise<void>;
  load(): Promise<void>;
  seconds(stage: string): number;
}

// A separate store keeps unfinished stage clocks independent of progress restarts. Mutations
// update memory immediately, coalescing persistence until a checkpoint or lifecycle flush.
export function stageStatsStore(
  storage: SaveStorage,
  stages: ReadonlySet<string>,
  destinations: Destinations = [],
): StageStatsStore {
  const store = saveStore(storage, KEYS, statsFormat(stages, destinations));
  let stats = fresh();
  let pending: Promise<unknown> = Promise.resolve();
  let checkpoint: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  const flush = async () => {
    if (checkpoint !== undefined) {
      clearTimeout(checkpoint);
      checkpoint = undefined;
    }
    if (dirty) {
      dirty = false;
      pending = store.save(stats);
    }
    await pending;
  };
  const changed = () => {
    dirty = true;
    if (checkpoint === undefined) {
      checkpoint = setTimeout(() => {
        checkpoint = undefined;
        void flush();
      }, CHECKPOINT_MS);
    }
  };
  const knownStage = (stage: string) => {
    if (!stages.has(stage)) {
      throw new Error("Unknown stats stage");
    }
  };
  const emptyRun = (): StageRun => ({
    attemptSeconds: 0,
    attempts: 1,
    completed: false,
    runSeconds: 0,
  });
  const update = (stage: string, run: StageRun | undefined) => {
    knownStage(stage);
    const previous = stats.stages[stage] ?? {};
    const entry: StageStats = {
      ...(previous.bestSeconds !== undefined && { bestSeconds: previous.bestSeconds }),
      ...(run && { run }),
    };
    const visit = stats.visit;
    const belongs =
      visit && destinations.find(({ id }) => id === visit.zone)?.stages.includes(stage);
    stats = {
      ...stats,
      stages: { ...stats.stages, [stage]: entry },
      ...(visit &&
        belongs &&
        run && { visit: { ...visit, stages: { ...visit.stages, [stage]: run } } }),
    };
    changed();
  };
  const summary = (stage: string): RunStatsSummary => {
    const current = stats.stages[stage];
    return runSummary(current?.bestSeconds, current?.run ? [current.run] : []);
  };
  const visitSummary = (zone: string): ZoneStatsSummary => {
    const destination = destinations.find(({ id }) => id === zone);
    if (!destination) {
      throw new Error("Unknown stats zone");
    }
    const runs = stats.visit?.zone === zone ? Object.values(stats.visit.stages) : [];
    const completed = runs.filter((run) => run.completed).length;
    const total = destination.stages.length;
    return {
      ...runSummary(stats.zones[zone], runs),
      completed,
      partial: completed !== total,
      total,
    };
  };
  return {
    addActiveTime(stage, seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) {
        throw new Error("Invalid active play duration");
      }
      if (seconds > 0) {
        const run = stats.stages[stage]?.run ?? emptyRun();
        update(stage, {
          ...run,
          attemptSeconds: run.attemptSeconds + seconds,
          runSeconds: run.runSeconds + seconds,
        });
      }
    },
    beginRun(stage) {
      update(stage, emptyRun());
    },
    beginVisit(zone) {
      if (!destinations.some(({ id }) => id === zone)) {
        throw new Error("Unknown stats zone");
      }
      stats = { ...stats, visit: { stages: {}, zone } };
      changed();
    },
    clearStage(stage) {
      update(stage, undefined);
      void flush();
    },
    completeStage(stage) {
      const run = stats.stages[stage]?.run;
      if (!run) {
        throw new Error("Cannot complete a stage without a run");
      }
      update(stage, { ...run, completed: true });
      const entry = stats.stages[stage]!;
      stats = {
        ...stats,
        stages: {
          ...stats.stages,
          [stage]: {
            ...entry,
            bestSeconds: Math.min(entry.bestSeconds ?? Infinity, run.attemptSeconds),
          },
        },
      };
      const zone = stats.visit?.zone;
      if (zone !== undefined) {
        const visit = visitSummary(zone);
        if (!visit.partial) {
          stats = {
            ...stats,
            zones: {
              ...stats.zones,
              [zone]: Math.min(stats.zones[zone] ?? Infinity, visit.attemptSeconds),
            },
          };
        }
      }
      void flush();
      return summary(stage);
    },
    flush,
    async load() {
      stats = (await store.load()).save;
    },
    retryStage(stage) {
      const run = stats.stages[stage]?.run;
      if (!run) {
        throw new Error("Cannot retry a stage without a run");
      }
      update(stage, { ...run, attemptSeconds: 0, attempts: run.attempts + 1, completed: false });
    },
    seconds: (stage) => stats.stages[stage]?.run?.runSeconds ?? 0,
    summary,
    visitSummary,
  };
}
