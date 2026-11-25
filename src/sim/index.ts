// The simulator's library for the test harness and the tools: the bot, navigation, walk search,
// stage simulation, boss simulator and properties, catalogue, path-out checks and zone traces.
// The CLIs beside it are entries of their own.
export { hasDynamicMotion } from "./behaviourBounds.ts";
export {
  committedHold,
  crossesAfterSettle,
  leavesSpawn,
  maximumTellSeconds,
  movesAtLeast,
  movesWhileEngaged,
  pacesNearest,
  risesToRow,
  tellPauseLasts,
} from "./bossProperties.ts";
export {
  activateAll,
  areaExit,
  type BossController,
  type BossCoverage,
  bossModel,
  bossSample,
  type BossScenario,
  bossStart,
  type BossTick,
  botChibi,
  scriptedChibi,
  supportWorld,
} from "./bossSimulator.ts";
export { botInput, DIAGNOSTIC_SKILL, FORWARD_POLICY, newBot, prepareSensors } from "./bot.ts";
export { nodeArt, preparedPlan, stageLoader } from "./catalogue.ts";
export { default as SHARED_DOCK } from "./fixtures/sharedDock.json" with { type: "json" };
export {
  NAVIGATION_DEFAULTS,
  NAVIGATION_VALIDATION,
  navigationSnapshot,
  plannedInput,
} from "./navigation.ts";
export {
  ALLOW,
  chibiMap,
  type Encounter,
  hitboxAt,
  NO_DISABLED_EDGES,
  pathOut,
  pathOutEncounter,
  standingAt,
} from "./pathOut.ts";
export {
  type PreparedStage,
  type RunResult,
  simulateStage,
  type SimulationConfig,
} from "./simulate.ts";
export { type SimulationStart } from "./start.ts";
export { zoneTraceLine } from "./zoneTrace.ts";
export {
  crosses,
  requiredRouteObservation,
  requiredRouteTargetReached,
  type RequiredRouteWalk,
  type Surface,
  surfaceAt,
  walkRequiredRoutes,
  type WalkRouteQuery,
  type WalkRouteTarget,
  walkZone,
  zoneSurfaces,
  type ZoneWalk,
} from "./zoneWalk.ts";
