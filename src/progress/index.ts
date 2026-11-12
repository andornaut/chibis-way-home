// Progress through the game: the map and its destinations, stage completion routing, the
// opening, skill ownership and selection, achievements, and the save formats. src/progress/save/pageSave.ts
// opens the page's saves on load, so it stays out of this index.
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
export { middleChunkIds, recentMiddleChunks, withRecentMiddleChunks } from "./recentChunks.ts";
export { ACHIEVEMENTS_VERSION } from "./save/achievements.ts";
export { type Progress, PROGRESS_VERSION, type RecentChunks } from "./save/progress.ts";
export {
  formatRunStats,
  timeText,
  type WholeRunDisplaySummary,
  wholeRunSummary,
} from "./save/runSummary.ts";
export type { SavedSkillGrantResult } from "./save/savedSkillGrant.ts";
export {
  type RunStatsSummary,
  STATS_VERSION,
  type WholeRunStatsSummary,
  type ZoneStatsSummary,
} from "./save/stats.ts";
export {
  eligibleSkills,
  isSkillId,
  SKILL_IDS,
  SKILL_PROFILES,
  skillEnabled,
  type SkillOverrides,
  skillTuning,
} from "./skills.ts";
export { type StageCompletion, stageCompletion, stageExit } from "./stageCompletion.ts";
