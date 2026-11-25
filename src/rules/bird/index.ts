// Chibi's body and the motion primitives under every other rules area: the bird step, dash and
// support, crumbling supports, gust force, tracks, orbits, platform carry and scenery playback.
export {
  birdBox,
  type BirdDashState,
  birdFrameRect,
  type BirdInput,
  type BirdState,
  ordinaryHorizontalVelocity,
  ordinaryJumpApexFeetY,
  ordinaryJumpReleaseTargetHeight,
  startBird,
  startsDash,
  stepBird,
  stepBirdWithSupport,
} from "./bird.ts";
export {
  type CrumblingActor,
  crumblingDefinitions,
  crumblingSupportPresent,
  initialCrumblingWorld,
  validateCrumblingProfile,
} from "./crumbling.ts";
export { beginCrumblingFrame, endCrumblingFrame } from "./crumblingFrame.ts";
export { type ForcePulse, forcePulseVelocity, forcePulseVolume } from "./force.ts";
export { axisOf, hopLift, motionTrack, type Track } from "./motion.ts";
export {
  namespaceOrbitInstances,
  orbitBounds,
  orbitHostLegs,
  type OrbitLeg,
  orbitPosition,
  orbitSweptContact,
  pathLedge,
  pendulumAngle,
  pendulumCycleSeconds,
  prefixInstanceIds,
  resolveOrbits,
  validateOrbitReferences,
} from "./orbit.ts";
export { finishPlatformBird, preparePlatformBird, standsOn } from "./platformBird.ts";
export { type SceneryPlaybackState, stepSceneryPlayback } from "./sceneryPlayback.ts";
