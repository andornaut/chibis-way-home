// The proofs the certification CLI runs: arena, current-list and selected-pair certification and
// the arena approach traces. Tests import the harness modules directly.
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
