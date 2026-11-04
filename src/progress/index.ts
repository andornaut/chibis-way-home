// Progress through the game: the map and its destinations, stage completion routing, the
// opening, skill ownership and selection, and the save formats. src/progress/save/pageSave.ts
// opens the page's saves on load, so it stays out of this index.
export { isLastZone, nodeOf, type OpenMap, openMap } from "./map";
export {
  destinationForStage,
  destinationOf,
  destinationSelection,
  destinationStages,
  steppedDestination,
} from "./mapDestinations";
export { createOpeningPlayback, openingDestination } from "./opening";
export { type Progress, PROGRESS_VERSION } from "./save/progress";
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
  skillEnabled,
  type SkillOverrides,
  skillTuning,
} from "./skills";
export { type StageCompletion, stageCompletion } from "./stageCompletion";
