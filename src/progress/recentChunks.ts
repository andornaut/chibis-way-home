import { RECENT_STAGES } from "../data/stageProgress";
import type { ZonePlan } from "../data/types";
import type { Progress } from "./save/progress";

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

// The ids of plan's middle chunks: each area's placed chunks but its first and last, which are
// the stage's start and finish caps or a section's, in area order, each once.
export function middleChunkIds(plan: ZonePlan): readonly string[] {
  const order = plan.areaOrder ?? Object.keys(plan.areas);
  return [
    ...new Set(
      order.flatMap((area) =>
        (plan.areas[area]?.chunks ?? []).slice(1, -1).map(({ chunk }) => chunk),
      ),
    ),
  ];
}
