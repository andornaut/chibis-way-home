// Phaser-free picks of what the world draws: each sprite's tag, frame and whole-pixel position
// from the game state, so the scenes only draw what is picked.
export { type AirJumpCue, airJumpCue, stepAirJumpCue } from "./airJumpCue.ts";
export { backdropBottomRect } from "./backdropBottom.ts";
export { backgroundGroundOffset, backgroundGroundReference } from "./backgroundGround.ts";
export { behaviourPose } from "./behaviour.ts";
export { birdFrameAt, type BirdPose, clearAirJumpPose, startPose, stepPose } from "./bird.ts";
export { BOSS_REMOVAL_ART, bossRemovalView } from "./bossRemoval.ts";
export { bossWarning, type BossWarningTuning } from "./bossWarning.ts";
export { characterState, nextQuirkAt } from "./character.ts";
export { chunkBackdropSpan, chunkParallax } from "./chunkParallax.ts";
export {
  crumblingAppearance,
  type CrumblingSkin,
  crumblingSkinTiles,
} from "./crumblingPresentation.ts";
export { dashTrail } from "./dashTrail.ts";
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
export { interiorBackdrop } from "./interiorBackdrop.ts";
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
export { zoneTheme } from "./zoneTheme.ts";
