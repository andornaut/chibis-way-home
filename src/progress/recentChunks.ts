import { RECENT_STAGES } from "../data/stageProgress.ts";
import type { Progress } from "./save/progress.ts";

// The middle chunk ids of the zone's latest stage entries, newest first, each once: none from the
// beginning or before the zone's first recorded entry.
export function recentMiddleChunks(progress: Progress, zone: string): readonly string[] {
  if (progress.at !== "map") {
    return [];
  }
  return [...new Set((progress.recent?.[zone] ?? []).flat())];
}

// progress with middle as the zone's newest stage entry, keeping RECENT_STAGES entries. The
// beginning has no recent chunks, so it is returned as it is.
export function withRecentMiddleChunks(
  zone: string,
  middle: readonly string[],
  progress: Progress,
): Progress {
  if (progress.at !== "map") {
    return progress;
  }
  const entries = [middle, ...(progress.recent?.[zone] ?? [])].slice(0, RECENT_STAGES);
  return { ...progress, recent: { ...progress.recent, [zone]: entries } };
}
