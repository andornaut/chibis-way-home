// Phaser-free picks of what the world draws: each sprite's tag, frame and whole-pixel position
// from the game state, so the scenes only draw what is picked.
export { type AirJumpCue, airJumpCue, stepAirJumpCue } from "./airJumpCue";
export { backdropBottomRect } from "./backdropBottom";
export { backgroundGroundOffset, backgroundGroundReference } from "./backgroundGround";
export { behaviourPose } from "./behaviour";
export { birdFrameAt, type BirdPose, clearAirJumpPose, startPose, stepPose } from "./bird";
export { BOSS_REMOVAL_ART, type BossRemovalView, bossRemovalView } from "./bossRemoval";
export { bossWarning, type BossWarningTuning } from "./bossWarning";
export { characterState, nextQuirkAt } from "./character";
export { chunkBackdropSpan, chunkParallax } from "./chunkParallax";
export {
  crumblingAppearance,
  type CrumblingSkin,
  crumblingSkinTiles,
} from "./crumblingPresentation";
export { dashTrail } from "./dashTrail";
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
} from "./death";
export { doorPhase } from "./doorOpen";
export { forceVisualPosition } from "./forceVisual";
export { interiorBackdrop } from "./interiorBackdrop";
export { type ArtKind, artKind, artOffset, artScrollFactor } from "./objectArt";
export { type PlayHold, stepAction } from "./playHold";
export { scenerySpriteFrame } from "./scenerySprite";
export { STAGE_PROGRESS_STYLE } from "./stageProgress";
export { loadedTileset, lookTiles, objectTiles, type PlacedTile, terrainTiles } from "./tiles";
export { barkOwnerOnscreen, proximityDialogue } from "./zoneDialogue";
export { zoneTheme } from "./zoneTheme";
