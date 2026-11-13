import type { CertifiedChunks, ZoneKey } from "../data/types/index.ts";
import {
  type Candidate,
  dataHash,
  entryOf,
  GAME_CONTEXT,
  layoutOf,
  ORDINARY_PROOF_PROFILE,
  type Proof,
  proofProfileProblems,
  proofsHash,
  structuralProblems,
  verifyStructure,
  zoneCandidates,
} from "./pairCertify.ts";

export interface PairProposalPlan {
  readonly current: CertifiedChunks;
  readonly data: string;
  readonly selected: readonly {
    readonly candidate: Candidate;
    readonly layout: string;
    readonly themes: readonly string[];
  }[];
}

// Select new pairs without running a walk, an arena proof or assembly feasibility.
export function preparePairProposal(
  zone: ZoneKey,
  current: CertifiedChunks,
  ids: readonly string[],
): PairProposalPlan {
  if (current.zone !== zone || ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error("A proposal requires one matching zone and unique selected IDs");
  }
  if (current.inputs.proofs !== proofsHash()) {
    throw new Error("Existing proof provenance is stale");
  }
  const { candidates } = zoneCandidates(GAME_CONTEXT, zone);
  const data = dataHash(GAME_CONTEXT, zone, candidates);
  const existing = verifyStructure(GAME_CONTEXT, {
    ...current,
    inputs: { ...current.inputs, data },
  });
  if (existing.length > 0) {
    throw new Error(existing.join("; "));
  }
  const previous = new Set(current.entries.map(({ id }) => id));
  const selected = [...ids].sort().map((id) => {
    const candidate = candidates.find((candidate) => candidate.id === id);
    if (candidate === undefined || candidate.kind !== "pair" || previous.has(id)) {
      throw new Error(`Not a new selected pair: ${id}`);
    }
    const problems = structuralProblems(zone, candidate);
    if (problems.length > 0) {
      throw new Error(`${id}: ${problems.join("; ")}`);
    }
    return { candidate, ...layoutOf(zone, candidate) };
  });
  return { current, data, selected };
}

// A scratch proposal preserves existing entries and arenas, and accepts only ordinary native proofs.
export function completePairProposal(
  plan: PairProposalPlan,
  proofs: readonly Proof[],
): CertifiedChunks {
  if (proofs.length !== plan.selected.length) {
    throw new Error("Every selected pair requires one proof");
  }
  const additions = plan.selected.map(({ candidate, layout }, index) => {
    const proof = proofs[index]!;
    const count = /^([a-f0-9]{16}):(\d+)$/.exec(proof.trace);
    if (
      proof.problems.length > 0 ||
      proof.proof === undefined ||
      proofProfileProblems(proof.proof).length > 0 ||
      proof.proof.tuning !== ORDINARY_PROOF_PROFILE.tuning ||
      !Number.isSafeInteger(proof.work) ||
      proof.work <= 0 ||
      count === null ||
      Number(count[2]) !== proof.work
    ) {
      throw new Error(`${candidate.id}: ordinary native proof is incomplete or invalid`);
    }
    return entryOf(candidate, layout, proof);
  });
  const proposal = {
    ...plan.current,
    entries: [...plan.current.entries, ...additions].sort((left, right) =>
      left.id < right.id ? -1 : 1,
    ),
    inputs: { ...plan.current.inputs, data: plan.data },
  };
  const problems = verifyStructure(GAME_CONTEXT, proposal);
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
  return proposal;
}
