// Progress through the game: the map and its destinations, stage completion routing, the
// opening, skill ownership and selection, achievements, and the save formats. src/progress/save/pageSave.ts
// opens the page's saves on load, so it stays out of this index.
export {
  ACHIEVEMENT_IDS,
  achievementEntries,
  type AchievementEntry,
  type AchievementProgress,
  ORDERED_ACHIEVEMENTS,
} from "./achievements";
export { isLastZone, nodeOf, type OpenMap, openMap } from "./map";
export {
  destinationForStage,
  destinationOf,
  destinationSelection,
  destinationStages,
  steppedDestination,
} from "./mapDestinations";
export { createOpeningPlayback, openingDestination } from "./opening";
export { middleChunkIds, recentMiddleChunks, withRecentMiddleChunks } from "./recentChunks";
export { ACHIEVEMENTS_VERSION } from "./save/achievements";
export { type Progress, PROGRESS_VERSION, type RecentChunks } from "./save/progress";
export {
  formatRunStats,
  timeText,
  type WholeRunDisplaySummary,
  wholeRunSummary,
} from "./save/runSummary";
export {
  type RunStatsSummary,
  STATS_VERSION,
  type WholeRunStatsSummary,
  type ZoneStatsSummary,
} from "./save/stats";
export {
  eligibleSkills,
  isSkillId,
  SKILL_IDS,
  SKILL_PROFILES,
  skillEnabled,
  type SkillOverrides,
  skillTuning,
} from "./skills";
export { type StageCompletion, stageCompletion, stageExit } from "./stageCompletion";
