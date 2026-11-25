// Behaviour-driven objects: the perceive, decide and act executor, encounters, perception, movement
// maps, boss defeat, and the hazards, collision phases and transients those objects drive.
export {
  type BehaviourEvent,
  type BehaviourState,
  type BehaviourStep,
  layoutBehaviour,
} from "./behaviour.ts";
export { planMapLeg } from "./behaviourMapPursuit.ts";
export {
  type BehaviourChoiceObservation,
  type BehaviourFact,
  type BehaviourObservation,
  type BehaviourObserver,
  type BehaviourObserverFailure,
  type BehaviourPursuitObservation,
  type BehaviourWorkMetric,
  createBehaviourObserver,
  recordBehaviourWork,
} from "./behaviourObserver.ts";
export {
  type BehaviourGeometry,
  type BehaviourPlatformFrame,
  type BehaviourTraversalFrame,
  type BehaviourWorld,
  behaviourWorld,
  type CrumblingPrediction,
  type SupportSampler,
} from "./behaviourReach.ts";
export { unacquiredBehaviourNodes } from "./behaviourScope.ts";
export { contactBox, nodeOf } from "./behaviourTrack.ts";
export { traversalContext } from "./behaviourTraversal.ts";
export { bossDeath, isBoss, removalProgress } from "./bossDefeat.ts";
export {
  clockedSupport,
  clockPresent,
  effectiveCollision,
  effectiveGustPhase,
  effectiveHazardPhase,
  effectiveSupportPhase,
  validateGustPhases,
  validateHazardPhases,
  validateSupportPhases,
} from "./effectiveCollision.ts";
export {
  type EncounterEvent,
  type EncounterStep,
  settleEncounter,
  stepEncounter,
} from "./encounter.ts";
export { supportContact } from "./flyLanding.ts";
export { hazardOccupancy } from "./hazardOccupancy.ts";
export {
  airMask,
  BOSS_JUMP_SCRIPTS,
  bossMovementProfiles,
  chibiJumpScripts,
  chibiMovementProfile,
  flightMap,
  groundMap,
  groundMask,
  type MapSupport,
  type MapTerrain,
  mapTerrain,
  type PreparedZone,
  preparedZone,
  prepareZone,
  pursuitGroundMap,
} from "./movementMaps.ts";
export { currentScreen, targetVisible } from "./perception.ts";
export { phaseFollowerTag, resolvePhaseSources } from "./phaseSource.ts";
export { timedHazardRect } from "./timedHazard.ts";
export { type SpawnEvent, stepTransients, type Transient, transientBox } from "./transients.ts";
