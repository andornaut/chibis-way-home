import { saveStore } from "@andornaut/game-kit/save/saveStore";
import type { SaveStorage } from "@andornaut/game-kit/save/storage";
import type { Checked, SaveFormat, StoredObject } from "@andornaut/game-kit/save/versionedSave";

export interface StageStats {
  readonly activeSeconds: number;
}

export interface Stats {
  readonly stages: Readonly<Record<string, StageStats>>;
}

export const STATS_VERSION = 4;
const KEYS = {
  backup: "chibis-way-home.stats-backup",
  save: "chibis-way-home.stats",
} as const;
// A dirty clock is checkpointed at most once per second between lifecycle flushes.
const CHECKPOINT_MS = 1000;
const fresh = (): Stats => ({ stages: {} });

export function statsFormat(stages: ReadonlySet<string>): SaveFormat<Stats> {
  const checked = (value: unknown): Checked<Stats> => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, reason: "stats are not an object" };
    }
    const entries = value as Record<string, unknown>;
    const stored = entries.stages;
    if (stored === null || typeof stored !== "object" || Array.isArray(stored)) {
      return { ok: false, reason: "stats stages are not an object" };
    }
    for (const [key, stage] of Object.entries(stored)) {
      if (!stages.has(key) || stage === null || typeof stage !== "object" || Array.isArray(stage)) {
        return { ok: false, reason: "stats name an unknown stage or invalid clock" };
      }
      const seconds = (stage as Record<string, unknown>).activeSeconds;
      if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
        return { ok: false, reason: "stats contain an invalid active time" };
      }
    }
    return { ok: true, value: { stages: stored as Record<string, StageStats> } };
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
): StageStatsStore {
  const store = saveStore(storage, KEYS, statsFormat(stages));
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
  const update = (stage: string, seconds: number) => {
    if (!stages.has(stage) || !Number.isFinite(seconds) || seconds < 0) {
      throw new Error("Invalid stage clock update");
    }
    stats = { stages: { ...stats.stages, [stage]: { activeSeconds: seconds } } };
    dirty = true;
    if (checkpoint === undefined) {
      checkpoint = setTimeout(() => {
        checkpoint = undefined;
        void flush();
      }, CHECKPOINT_MS);
    }
  };
  return {
    addActiveTime(stage, seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) {
        throw new Error("Invalid active play duration");
      }
      if (seconds > 0) {
        update(stage, (stats.stages[stage]?.activeSeconds ?? 0) + seconds);
      }
    },
    clearStage(stage) {
      update(stage, 0);
      void flush();
    },
    flush,
    async load() {
      stats = (await store.load()).save;
    },
    seconds: (stage) => stats.stages[stage]?.activeSeconds ?? 0,
  };
}
