import type {
  CertifiedChunks,
  CertifiedEntry,
  OrdinaryProofProfile,
  ZoneKey,
} from "../data/types/index.ts";
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
  verifyEntryStructure,
  zoneCandidates,
} from "./pairCertify.ts";

export interface PairProposalPlan {
  readonly current: CertifiedChunks;
  readonly data: string;
  readonly selected: readonly {
    readonly candidate: Candidate;
    readonly layout: string;
    readonly previous?: CertifiedEntry;
    readonly themes: readonly string[];
  }[];
}

// Select new pairs, new singles or already admitted legacy entries without running proofs.
export function preparePairProposal(
  zone: ZoneKey,
  current: CertifiedChunks,
  ids: readonly string[],
  mode: "pair" | "single" | "reprove-existing" = "pair",
): PairProposalPlan {
  if (current.zone !== zone || ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error("A proposal requires one matching zone and unique selected IDs");
  }
  if (current.inputs.proofs !== proofsHash()) {
    throw new Error("Existing proof provenance is stale");
  }
  const reproveExisting = mode === "reprove-existing";
  const { candidates } = zoneCandidates(GAME_CONTEXT, zone);
  const data = dataHash(GAME_CONTEXT, zone, candidates);
  const existing = verifyEntryStructure(GAME_CONTEXT, {
    ...current,
    inputs: reproveExisting ? current.inputs : { ...current.inputs, data },
  });
  if (existing.length > 0) {
    throw new Error(existing.join("; "));
  }
  const previous = new Map(current.entries.map((entry) => [entry.id, entry]));
  const selected = [...ids].sort().map((id) => {
    const candidate = candidates.find((candidate) => candidate.id === id);
    const entry = previous.get(id);
    if (
      reproveExisting &&
      (candidate === undefined || entry === undefined || entry.proof !== undefined)
    ) {
      throw new Error(`Not an existing legacy entry: ${id}`);
    }
    if (
      candidate === undefined ||
      (!reproveExisting && (candidate.kind !== mode || entry !== undefined))
    ) {
      throw new Error(`Not a new selected ${mode}: ${id}`);
    }
    const problems = structuralProblems(zone, candidate);
    if (problems.length > 0) {
      throw new Error(`${id}: ${problems.join("; ")}`);
    }
    return {
      candidate,
      ...layoutOf(zone, candidate),
      ...(entry !== undefined && { previous: entry }),
    };
  });
  return { current, data, selected };
}

// A scratch proposal changes only the selected entries, and accepts only ordinary native proofs.
export function completePairProposal(
  plan: PairProposalPlan,
  proofs: readonly Proof[],
): CertifiedChunks {
  if (proofs.length !== plan.selected.length) {
    throw new Error("Every selected entry requires one proof");
  }
  const entries = new Map(plan.current.entries.map((entry) => [entry.id, entry]));
  plan.selected.forEach(({ candidate, layout }, index) => {
    const proof = proofs[index]!;
    const count = /^([a-f0-9]{16}):(\d+)$/.exec(proof.trace);
    if (proof.problems.length > 0) {
      throw new Error(
        `${candidate.id}: ordinary native proof is incomplete or invalid: ${proof.problems.join("; ")}`,
      );
    }
    if (
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
    entries.set(candidate.id, entryOf(candidate, layout, proof));
  });
  const proposal = {
    ...plan.current,
    entries: [...entries.values()].sort((left, right) => (left.id < right.id ? -1 : 1)),
    inputs: { ...plan.current.inputs, data: plan.data },
  };
  const problems = verifyEntryStructure(GAME_CONTEXT, proposal);
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
  return proposal;
}

// Reuse must reject unknown profiles before retaining an existing native trace.
function existingProofProfileProblems(current: Pick<CertifiedChunks, "entries">): string[] {
  return current.entries.flatMap((entry) =>
    proofProfileProblems(entry.proof).map((problem) => `${entry.id}: ${problem}`),
  );
}

// A fully ordinary maintained list never gives newly considered entries a skill-capable proof.
export function newEntryProofProfile(
  current: Pick<CertifiedChunks, "entries"> | undefined,
): OrdinaryProofProfile | undefined {
  if (current === undefined) {
    return undefined;
  }
  const problems = existingProofProfileProblems(current);
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
  return current.entries.length > 0 && current.entries.every(({ proof }) => proof !== undefined)
    ? ORDINARY_PROOF_PROFILE
    : undefined;
}
