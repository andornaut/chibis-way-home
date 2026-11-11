import type { EarnedRecord } from "@andornaut/game-kit/achievements";
import type { SaveStorage } from "@andornaut/game-kit/save/storage";
import { encodeSave, loadSave } from "@andornaut/game-kit/save/versionedSave";

import { CHUNKS } from "../../data/chunks";
import { ZONE_MAP } from "../../data/map";
import type { AchievementId } from "../../data/types";
import { RECIPES } from "../../data/zones";
import { SKILL_IDS } from "../skills";
import { ACHIEVEMENT_KEYS, ACHIEVEMENTS_FORMAT } from "./achievements";
import { type Progress, PROGRESS_KEYS, progressFormat } from "./progress";
import { skillGrantEffects, withGrantedSkill } from "./skillGrant";
import { STATS_KEYS, statsFormat } from "./stats";
type SavedStats = ReturnType<ReturnType<typeof statsFormat>["fresh"]>;
export type SkillGrantRecord = "progress" | "stats" | "achievements";
export interface SkillGrantWrite {
  readonly available: boolean;
  readonly error?: string;
  readonly record: SkillGrantRecord;
  readonly status: "saved" | "blocked" | "unavailable";
}
interface ResultFacts {
  readonly written: readonly SkillGrantRecord[];
  readonly writes: readonly SkillGrantWrite[];
}
export type SavedSkillGrantResult = ResultFacts &
  (
    | {
        readonly status: "saved" | "unchanged";
      }
    | {
        readonly status: "blocked" | "invalid" | "unavailable";
        readonly record?: SkillGrantRecord;
        readonly reason: string;
      }
    | {
        readonly status: "partial";
        readonly record?: SkillGrantRecord;
        readonly cause: "blocked" | "unavailable";
        readonly reason: string;
      }
  );
export interface SavedSkillGrantSnapshot {
  readonly achievements: EarnedRecord<AchievementId>;
  readonly awarded: readonly AchievementId[];
  readonly progress: Progress;
  readonly stats: SavedStats;
}
export interface SavedSkillGrantContext {
  readonly available: () => boolean;
  readonly committed: (snapshot: SavedSkillGrantSnapshot) => void;
}
const progressFormatForGame = progressFormat(ZONE_MAP, RECIPES, new Set(Object.keys(CHUNKS)));
const statsFormatForGame = statsFormat(
  new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages)),
  ZONE_MAP.destinations,
);
// This explicit save edit never changes the practice session or substitutes a fresh unreadable save.
export async function grantStoredSkills(
  context: SavedSkillGrantContext,
  storage: SaveStorage,
): Promise<SavedSkillGrantResult> {
  const written: SkillGrantRecord[] = [];
  const writes: SkillGrantWrite[] = [];
  const facts = () => ({ writes: [...writes], written: [...written] });
  if (!context.available()) {
    return { ...facts(), reason: "action_unavailable", status: "blocked" };
  }
  const inputs: {
    readonly record: SkillGrantRecord;
    readonly key: string;
  }[] = [
    { key: PROGRESS_KEYS.save, record: "progress" },
    { key: STATS_KEYS.save, record: "stats" },
    { key: ACHIEVEMENT_KEYS.save, record: "achievements" },
  ];
  const raw: Record<SkillGrantRecord, string | null> = {
    achievements: null,
    progress: null,
    stats: null,
  };
  const loadedRaw = await Promise.all(
    inputs.map(async (input) => {
      try {
        return { ...input, ok: true as const, value: await storage.read(input.key) };
      } catch {
        return { ...input, ok: false as const };
      }
    }),
  );
  for (const input of loadedRaw) {
    if (!input.ok) {
      return { ...facts(), reason: "read_failed", record: input.record, status: "unavailable" };
    }
    raw[input.record] = input.value;
  }
  if (!context.available()) {
    return { ...facts(), reason: "action_unavailable", status: "blocked" };
  }
  const profile = loadSave(progressFormatForGame, raw.progress);
  const totals = loadSave(statsFormatForGame, raw.stats);
  const earned = loadSave(ACHIEVEMENTS_FORMAT, raw.achievements);
  for (const [record, result] of [
    ["progress", profile],
    ["stats", totals],
    ["achievements", earned],
  ] as const) {
    if (result.status !== "loaded" && result.status !== "new") {
      return { ...facts(), reason: result.status, record, status: "invalid" };
    }
  }
  let progress = profile.save;
  for (const skill of SKILL_IDS) {
    progress = withGrantedSkill(progress, skill);
  }
  const effects = skillGrantEffects(
    earned.save.earned,
    totals.save.wholeRun.skillUsed === true,
    progress,
  );
  const stats =
    effects.skillUsed === (totals.save.wholeRun.skillUsed === true)
      ? totals.save
      : { ...totals.save, wholeRun: { ...totals.save.wholeRun, skillUsed: effects.skillUsed } };
  const achievements =
    effects.awarded.length === 0
      ? earned.save
      : {
          earned: [...earned.save.earned, ...effects.awarded],
          unannounced: [...earned.save.unannounced, ...effects.awarded],
        };
  const encodings = [
    {
      before: profile.save,
      encoded: encodeSave(progressFormatForGame, progress),
      fields: ["activeSkill", "skills"],
      key: PROGRESS_KEYS.save,
      next: progress,
      record: "progress" as const,
    },
    {
      before: totals.save,
      encoded: encodeSave(statsFormatForGame, stats),
      fields: ["wholeRun"],
      key: STATS_KEYS.save,
      next: stats,
      record: "stats" as const,
    },
    {
      before: earned.save,
      encoded: encodeSave(ACHIEVEMENTS_FORMAT, achievements),
      fields: ["earned", "unannounced"],
      key: ACHIEVEMENT_KEYS.save,
      next: achievements,
      record: "achievements" as const,
    },
  ];
  for (const entry of encodings) {
    if (!entry.encoded.ok) {
      return { ...facts(), reason: "encode_failed", record: entry.record, status: "invalid" };
    }
  }
  // Refuse a stale source rather than overwriting another writer's newer progress.
  const refreshed = await Promise.all(
    inputs.map(async (input) => {
      try {
        return { ...input, ok: true as const, value: await storage.read(input.key) };
      } catch {
        return { ...input, ok: false as const };
      }
    }),
  );
  for (const input of refreshed) {
    if (!input.ok) {
      return { ...facts(), reason: "read_failed", record: input.record, status: "unavailable" };
    }
    if (input.value !== raw[input.record]) {
      return { ...facts(), reason: "record_changed", record: input.record, status: "blocked" };
    }
  }
  for (const entry of encodings) {
    if (JSON.stringify(entry.before) === JSON.stringify(entry.next)) {
      continue;
    }
    const available = context.available();
    if (!available) {
      writes.push({ available, record: entry.record, status: "blocked" });
      return written.length === 0
        ? { ...facts(), reason: "action_unavailable", record: entry.record, status: "blocked" }
        : {
            ...facts(),
            cause: "blocked",
            reason: "action_unavailable",
            record: entry.record,
            status: "partial",
          };
    }
    try {
      if (!entry.encoded.ok) {
        throw new Error("InvalidEncoding");
      }
      // Each completed write determines whether the next record may commit.
      // eslint-disable-next-line no-await-in-loop
      await storage.write(
        entry.key,
        patchSavedFields(raw[entry.record], entry.encoded.value, entry.fields),
      );
      written.push(entry.record);
      writes.push({ available, record: entry.record, status: "saved" });
    } catch (error) {
      writes.push({
        available,
        error: error instanceof Error ? error.name : "StorageError",
        record: entry.record,
        status: "unavailable",
      });
      return written.length === 0
        ? { ...facts(), reason: "write_failed", record: entry.record, status: "unavailable" }
        : {
            ...facts(),
            cause: "unavailable",
            reason: "write_failed",
            record: entry.record,
            status: "partial",
          };
    }
  }
  if (!context.available()) {
    return written.length === 0
      ? { ...facts(), reason: "cache_commit_unavailable", status: "blocked" }
      : { ...facts(), cause: "blocked", reason: "cache_commit_unavailable", status: "partial" };
  }
  context.committed({ achievements, awarded: effects.awarded, progress, stats });
  return { ...facts(), status: written.length === 0 ? "unchanged" : "saved" };
}

function patchSavedFields(raw: string | null, encoded: string, fields: readonly string[]): string {
  if (raw === null) {
    return encoded;
  }
  const original = JSON.parse(raw) as Record<string, unknown>;
  const changed = JSON.parse(encoded) as Record<string, unknown>;
  for (const field of fields) {
    if (Object.hasOwn(changed, field)) {
      original[field] = changed[field];
    }
  }
  return JSON.stringify(original);
}
