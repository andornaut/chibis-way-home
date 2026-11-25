// The live zone: the zone step, forced transit, death, crumbling presence, behaviour effects,
// stage progress, flow, tips and the step records achievements count.
export { activeStepSeconds, deathSupport } from "./death.ts";
export { stageProgress } from "./stageProgress.ts";
export {
  activateBehaviour,
  areaOf,
  enterArea,
  leaveRoom,
  type ObservedZoneStep,
  preparedZone,
  retryZone,
  roomOf,
  standsOn,
  startZone,
  stepZone,
  stepZoneBodies,
  stepZoneObserved,
  type ZoneBark,
  type ZoneInput,
  type ZoneState,
} from "./zone.ts";
export { presentTerrain, supportPresent, type ZoneCrumblingWorld } from "./zoneCrumbling.ts";
export {
  introductionForRun,
  type ZoneDepartureTarget,
  zoneExitFlow,
  type ZoneStory,
  zoneStoryForStage,
} from "./zoneFlow.ts";
export { zoneStepRecord } from "./zoneRecords.ts";
export { stepTips, tipsInView } from "./zoneTips.ts";
