// Phaser-free picks of what the world draws: each sprite's tag, frame and whole-pixel position
// from the game state, so the scenes only draw what is picked.
export { type AirJumpCue, airJumpCue, stepAirJumpCue } from "./actors/airJumpCue.ts";
export { behaviourPose } from "./actors/behaviour.ts";
export {
  birdFrameAt,
  type BirdPose,
  clearAirJumpPose,
  startPose,
  stepPose,
} from "./actors/bird.ts";
export { BOSS_REMOVAL_ART, bossRemovalView } from "./actors/bossRemoval.ts";
export { bossWarning, type BossWarningTuning } from "./actors/bossWarning.ts";
export { characterState, nextQuirkAt } from "./actors/character.ts";
export { dashTrail } from "./actors/dashTrail.ts";
export {
  backdropBottomRect,
  backgroundGroundOffset,
  backgroundGroundReference,
  chunkBackdropSpan,
  chunkParallax,
  interiorBackdrop,
} from "./backdrop/index.ts";
export {
  crumblingAppearance,
  type CrumblingSkin,
  crumblingSkinTiles,
} from "./crumblingPresentation.ts";
export {
  deathFrameIndex,
  deathLabels,
  type DeathPresentation,
  deathPresentationTarget,
  type DeathSummary,
  deathSummary,
  type DeathView,
  startDeathPresentation,
  stepDeathPresentation,
} from "./death.ts";
export { doorPhase } from "./doorOpen.ts";
export { forceVisualPosition, forceVisualSpan } from "./forceVisual.ts";
export { type ArtKind, artKind, artOffset, artScrollFactor } from "./objectArt.ts";
export { type PlayHold, stepAction } from "./playHold.ts";
export { scenerySpriteFrame } from "./scenerySprite.ts";
export { STAGE_PROGRESS_STYLE } from "./stageProgress.ts";
export {
  spokeSegments,
  type TetherLine,
  tetherLine,
  type TetherSegment,
  tetherSegments,
} from "./tether.ts";
export {
  loadedTileset,
  lookTiles,
  objectTiles,
  phaseSkinTiles,
  type PlacedTile,
  terrainTiles,
} from "./tiles.ts";
export { barkOwnerOnscreen, proximityDialogue } from "./zoneDialogue.ts";
export { zoneTheme } from "./zoneTheme/index.ts";
