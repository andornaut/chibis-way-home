// The agent core: ability tables, seeded random streams, trace recording and hashing, the
// headless simulation loop and the agent property checks the simulator and tests run.
export { type Ability, abilityFor, type AbilityResult, type AbilityTable } from "./ability.ts";
export {
  attackCadence,
  boundedStep,
  cancelledTellKeepsCooldown,
  cooldownHonoured,
  escapeAtDistance,
  everyTick,
  noAttackWhileEscaped,
  noStall,
  type Property,
  singleCommittedAttack,
  stillness,
  tellBounded,
  tellCancelPause,
  tellPrecedesCommit,
  tellResolves,
  tellStarts,
  travelBounded,
} from "./agentProperties.ts";
export { type AgentSample, type AgentTick, centre } from "./agentTrace.ts";
export { namedStreams, type RandomStreams } from "./randomStreams.ts";
export { simulate, type SimulationController, type SimulationModel } from "./simulation.ts";
export { canonicalTrace, type TraceRecorder, traceRecorder } from "./trace.ts";
