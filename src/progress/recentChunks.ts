import { RECENT_STAGES } from "../data/stageProgress.ts";
import type { Progress } from "./save/progress.ts";

// The middle chunk ids of the zone's latest stage entries, one list an entry, newest first: none
// from the beginning or before the zone's first recorded entry.
export function recentMiddleChunks(
  progress: Progress,
  zone: string,
): readonly (readonly string[])[] {
  return progress.at === "map" ? (progress.recent?.[zone] ?? []) : [];
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
