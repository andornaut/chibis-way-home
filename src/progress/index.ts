// Progress through the game: the map and its destinations, stage completion routing, the
// opening, skill ownership and selection, achievements, first-time tips, and the save formats
// that the page save (src/save/) reads and writes.
export {
  ACHIEVEMENT_IDS,
  achievementEntries,
  type AchievementEntry,
  type AchievementFacts,
  type AchievementProgress,
  type AchievementScope,
  earnedAt,
  ORDERED_ACHIEVEMENTS,
  zoneEndingAt,
} from "./achievements.ts";
export {
  giftDraw,
  type GiftVisit,
  type PreparedStageGift,
  prepareGift,
  sameGiftVisit,
} from "./gifts.ts";
export { isLastZone, nodeOf, type OpenMap, openMap } from "./map.ts";
export {
  destinationForStage,
  destinationOf,
  destinationSelection,
  destinationStages,
  stageDestinationId,
  steppedDestination,
} from "./mapDestinations.ts";
export { createOpeningPlayback, openingDestination } from "./opening.ts";
export { recentMiddleChunks, withRecentMiddleChunks } from "./recentChunks.ts";
export {
  ACHIEVEMENT_KEYS,
  ACHIEVEMENTS_FORMAT,
  ACHIEVEMENTS_VERSION,
  achievementsStore,
} from "./save/achievements.ts";
export {
  BEGINNING,
  mapProgress,
  mapProgressBase,
  type Progress,
  PROGRESS_KEYS,
  PROGRESS_VERSION,
  progressFormat,
  type RecentChunks,
} from "./save/progress.ts";
export {
  formatRunStats,
  timeText,
  type WholeRunDisplaySummary,
  wholeRunSummary,
} from "./save/runSummary.ts";
export {
  hasRecordedStats,
  type RunStatsSummary,
  stageStatsStore,
  STATS_KEYS,
  STATS_VERSION,
  statsFormat,
  type WholeRunStatsSummary,
  type ZoneStatsSummary,
} from "./save/stats.ts";
export { isSkillId, resolveActiveSkill, SKILL_IDS, SKILL_PROFILES, skillTuning } from "./skills.ts";
export { type StageCompletion, stageCompletion, stageExit } from "./stageCompletion.ts";
export {
  isSeenTip,
  type PlayTipId,
  type QueuedTip,
  type SeenTip,
  seenTip,
  TIP_IDS,
} from "./tips.ts";
