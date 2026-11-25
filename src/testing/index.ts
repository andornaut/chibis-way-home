// The proofs the certification CLI and the acceptance batch run: arena, current-list and
// selected-pair certification, the arena approach traces, the connector routes and the
// acceptance targets. Tests import the harness modules directly.
export {
  ACCEPTANCE_ARENAS,
  ACCEPTANCE_FAILURES,
  acceptanceProblems,
  missedTargets,
} from "./arenaAcceptance.ts";
export { canonicalApproachTrace } from "./arenaApproaches.ts";
export {
  ARENA_COST,
  certifiedArena,
  gameArenaOf,
  proveArena,
  verifyArenas,
  zoneArenas,
} from "./arenaCertify.ts";
export {
  ACCEPTANCE_CONNECTORS,
  connectorCases,
  missedConnectorTargets,
} from "./connectorAcceptance.ts";
export { connectorRoute } from "./connectorRoute.ts";
export {
  completeCurrentListProposal,
  type CurrentListResult,
  prepareCurrentListProposal,
} from "./currentListCertification.ts";
export {
  type Candidate,
  certificateFeasibilityProblems,
  completeArenaApproachQualification,
  dataHash,
  distinctLayouts,
  entryOf,
  feasibilityProblems,
  GAME_CONTEXT,
  hashOf,
  layoutOf,
  ORDINARY_PROOF_PROFILE,
  type Proof,
  proofsHash,
  proveForProfile,
  routeHash,
  structuralProblems,
  verifyStructure,
  zoneCandidates,
  ZONES,
} from "./pairCertify.ts";
export {
  completePairProposal,
  newEntryProofProfile,
  preparePairProposal,
} from "./selectedCertification.ts";
