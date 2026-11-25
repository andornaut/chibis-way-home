// Progress through the game: the map and its destinations, stage completion routing, the
// opening, skill ownership and selection, achievements, first-time tips, and the save formats.
// src/progress/save/pageSave.ts reads every zone's data, so it stays out of this index and out of
// the page's first module.
export {
  ACHIEVEMENT_IDS,
  achievementEntries,
  type AchievementEntry,
  type AchievementProgress,
  ORDERED_ACHIEVEMENTS,
} from "./achievements.ts";
export { isLastZone, nodeOf, type OpenMap, openMap } from "./map.ts";
export {
  destinationForStage,
  destinationOf,
  destinationSelection,
  destinationStages,
  steppedDestination,
} from "./mapDestinations.ts";
export { createOpeningPlayback, openingDestination } from "./opening.ts";
export { recentMiddleChunks, withRecentMiddleChunks } from "./recentChunks.ts";
export { ACHIEVEMENTS_VERSION } from "./save/achievements.ts";
export { type Progress, PROGRESS_VERSION, type RecentChunks } from "./save/progress.ts";
export {
  formatRunStats,
  timeText,
  type WholeRunDisplaySummary,
  wholeRunSummary,
} from "./save/runSummary.ts";
export {
  type RunStatsSummary,
  STATS_VERSION,
  type WholeRunStatsSummary,
  type ZoneStatsSummary,
} from "./save/stats.ts";
export { isSkillId, SKILL_IDS, SKILL_PROFILES, skillTuning } from "./skills.ts";
export { type StageCompletion, stageCompletion, stageExit } from "./stageCompletion.ts";
export {
  isSeenTip,
  type PlayTipId,
  type QueuedTip,
  type SeenTip,
  seenTip,
  TIP_IDS,
} from "./tips.ts";
