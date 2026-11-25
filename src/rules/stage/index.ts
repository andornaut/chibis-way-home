// Stage building: tiles to layouts, chunks, modules and arenas, zone assembly and plans, stage
// plans, previews, requests and barks, walk links and the page parameters that pick a stage.
export { arenaApproachProblems } from "./arenaApproaches.ts";
export {
  assembleStage,
  type ChunkLibrary,
  eligibleChunks,
  recipeChunkPool,
  themesOf,
  zonePlanOf,
} from "./assemble.ts";
export { chunkProblems } from "./chunk.ts";
export { bindElement } from "./elementBinding.ts";
export { composePair, ENCOUNTER_ROLES, moduleProblems, pairProblems } from "./modules.ts";
export { SEED_LIMIT } from "./pageParams.ts";
export { withRoomBuildings } from "./roomBuildings.ts";
export { createStageBarks } from "./stageBarks.ts";
export { applyStageGeometry } from "./stageGeometry.ts";
export { planStage, recipeKey, requirePlanned, stageTarget } from "./stagePlans.ts";
export {
  askedStagePreview,
  type StagePreview,
  stagePreviewPlan,
  stagePreviewScroll,
} from "./stagePreview.ts";
export { type StageEntry, type StageEntryContext, stageRequest } from "./stageRequest.ts";
export { objectLayout, tileRect, zoneLayout } from "./tiles.ts";
export { validateWalkEntries } from "./zoneLinks.ts";
export {
  arenaChunks,
  CHUNK_LIBRARY,
  STAGE_CONTEXT,
  STAGE_RECIPES,
  zoneOfTheme,
  zonePlanFor,
} from "./zonePlans.ts";
