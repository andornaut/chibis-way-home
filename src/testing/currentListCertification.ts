import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type { CertifiedChunks, CertifiedEntry, ZoneKey } from "../data/types/index.ts";
import { type ArenaProof, certifiedArena, gameArenaOf, verifyArenas } from "./arenaCertify.ts";
import {
  type Candidate,
  dataHash,
  entryOf,
  GAME_CONTEXT,
  layoutOf,
  type Proof,
  proofsHash,
  verifyEntryFacts,
  zoneCandidates,
  ZONES,
} from "./pairCertify.ts";

export interface CurrentListPreimage {
  readonly contents: string;
  readonly zone: ZoneKey;
}

export type CurrentListJob =
  | {
      readonly kind: "entry";
      readonly zone: ZoneKey;
      readonly previous: CertifiedEntry;
      readonly candidate: Candidate;
      readonly layout: string;
      readonly themes: readonly string[];
    }
  | {
      readonly kind: "arena";
      readonly zone: ZoneKey;
      readonly previous: CertifiedChunks["arenas"][number];
    };

export interface CurrentListProposalPlan {
  readonly lists: readonly {
    readonly contents: string;
    readonly sha256: string;
    readonly current: CertifiedChunks;
    readonly data: string;
  }[];
  readonly jobs: readonly CurrentListJob[];
  readonly proofs: string;
}

export type CurrentListResult =
  | { readonly kind: "entry"; readonly zone: ZoneKey; readonly id: string; readonly proof: Proof }
  | {
      readonly kind: "arena";
      readonly zone: ZoneKey;
      readonly id: string;
      readonly proof: ArenaProof;
    }
  | { readonly kind: "error"; readonly zone: ZoneKey; readonly id: string; readonly error: string };

export interface CurrentListDifference {
  readonly zone: ZoneKey;
  readonly id: string;
  readonly field: "trace" | "work" | "hash";
  readonly before: string | number;
  readonly after: string | number;
}

export interface CurrentListProposal {
  readonly status: "blocked" | "proposal";
  readonly problems: readonly string[];
  readonly differences: readonly CurrentListDifference[];
  readonly preimages: CurrentListProposalPlan["lists"];
  readonly results: readonly CurrentListResult[];
  readonly proposed?: readonly CertifiedChunks[];
}

const sha256 = (contents: string) => createHash("sha256").update(contents).digest("hex");
const keyOf = (zone: ZoneKey, id: string) => `${zone}/${id}`;
const same = isDeepStrictEqual;

// Freeze only the admitted inventory. Candidate enumeration supplies lookup and data hashes.
export function prepareCurrentListProposal(
  preimages: readonly CurrentListPreimage[],
): CurrentListProposalPlan {
  if (
    preimages.length !== ZONES.length ||
    new Set(preimages.map(({ zone }) => zone)).size !== ZONES.length ||
    preimages.some(({ zone }) => !ZONES.includes(zone))
  ) {
    throw new Error("Current-list proposals require exactly one preimage for every zone");
  }
  const jobs: CurrentListJob[] = [];
  const lists = [...preimages]
    .sort((a, b) => a.zone.localeCompare(b.zone))
    .map(({ contents, zone }) => {
      const current = JSON.parse(contents) as CertifiedChunks;
      if (current.zone !== zone || current.version !== 1) {
        throw new Error(`${zone}: invalid certificate zone or version`);
      }
      const { candidates } = zoneCandidates(GAME_CONTEXT, zone);
      const problems = [...verifyEntryFacts(candidates, current), ...verifyArenas(current)];
      if (problems.length > 0) {
        throw new Error(problems.join("; "));
      }
      const data = dataHash(GAME_CONTEXT, zone, candidates);
      if (current.inputs.data !== data) {
        throw new Error(`${zone}: data hash changed outside the frozen admitted preimage`);
      }
      for (const previous of current.entries) {
        if (
          !Number.isSafeInteger(previous.work) ||
          previous.work <= 0 ||
          !/^[a-f0-9]{16}:\d+$/.test(previous.trace)
        ) {
          throw new Error(`${zone}/${previous.id}: invalid recorded trace/work`);
        }
        const candidate = candidates.find(({ id }) => id === previous.id)!;
        jobs.push({ candidate, kind: "entry", previous, zone, ...layoutOf(zone, candidate) });
      }
      for (const previous of current.arenas) {
        jobs.push({ kind: "arena", previous, zone });
      }
      return { contents, current, data, sha256: sha256(contents) };
    });
  return { jobs, lists, proofs: proofsHash() };
}

// Actual native results remain diagnostic evidence even when a comparison blocks the proposal.
export function completeCurrentListProposal(
  plan: CurrentListProposalPlan,
  results: readonly CurrentListResult[],
): CurrentListProposal {
  const problems: string[] = [];
  const differences: CurrentListDifference[] = [];
  const expected = new Map(plan.jobs.map((job) => [keyOf(job.zone, job.previous.id), job]));
  const byId = new Map<string, CurrentListResult>();
  for (const result of results) {
    const key = keyOf(result.zone, result.id);
    if (!expected.has(key) || byId.has(key)) {
      problems.push(`${key}: unexpected or duplicate result`);
    }
    byId.set(key, result);
  }
  const entries = new Map<string, CertifiedEntry>();
  const arenas = new Map<string, CertifiedChunks["arenas"][number]>();
  for (const job of plan.jobs) {
    const key = keyOf(job.zone, job.previous.id);
    const result = byId.get(key);
    if (result === undefined || result.kind === "error" || result.kind !== job.kind) {
      problems.push(
        `${key}: ${result?.kind === "error" ? result.error : "missing or wrong-kind result"}`,
      );
      continue;
    }
    const proof = result.proof;
    if (proof.problems.length > 0 || !Number.isSafeInteger(proof.work) || proof.work <= 0) {
      problems.push(`${key}: incomplete native proof: ${proof.problems.join("; ")}`);
      continue;
    }
    const count = /^([a-f0-9]{16}):(\d+)$/.exec(proof.trace);
    if (count === null || (job.kind === "entry" && Number(count[2]) !== proof.work)) {
      problems.push(`${key}: invalid native trace/work`);
      continue;
    }
    if (job.kind === "entry" && result.kind === "entry") {
      if (!same(job.previous.proof, result.proof.proof)) {
        problems.push(`${key}: proof profile changed`);
        continue;
      }
      const entry = entryOf(job.candidate, job.layout, result.proof);
      const { trace: oldTrace, work: oldWork, ...oldFacts } = job.previous;
      const { trace, work, ...facts } = entry;
      if (!same(oldFacts, facts)) {
        problems.push(`${key}: recorded entry facts changed`);
        continue;
      }
      for (const [field, before, after] of [
        ["trace", oldTrace, trace],
        ["work", oldWork, work],
      ] as const) {
        if (before !== after) {
          differences.push({ after, before, field, id: entry.id, zone: job.zone });
        }
      }
      entries.set(key, entry);
    } else if (job.kind === "arena" && result.kind === "arena") {
      const evidence = result.proof.evidence;
      if (
        evidence.static.status !== "passed" ||
        evidence.functional.requiredRoutes.status !== "passed" ||
        evidence.functional.pathOut.status !== "passed" ||
        evidence.functional.evade.status !== "passed" ||
        evidence.challenge.status !== "passed"
      ) {
        problems.push(`${key}: incomplete arena evidence`);
        continue;
      }
      if (!/^[a-f0-9]{16}$/.test(result.proof.hash)) {
        problems.push(`${key}: invalid arena hash`);
        continue;
      }
      const arena = certifiedArena(gameArenaOf(job.previous.id), result.proof);
      if (arena.id !== job.previous.id || arena.stage !== job.previous.stage) {
        problems.push(`${key}: arena identity changed`);
        continue;
      }
      if (arena.hash !== job.previous.hash) {
        differences.push({
          after: arena.hash,
          before: job.previous.hash,
          field: "hash",
          id: arena.id,
          zone: job.zone,
        });
      }
      arenas.set(key, arena);
    }
  }
  if (proofsHash() !== plan.proofs) {
    problems.push("Proof input provenance changed during execution");
  }
  for (const list of plan.lists) {
    if (
      dataHash(
        GAME_CONTEXT,
        list.current.zone,
        zoneCandidates(GAME_CONTEXT, list.current.zone).candidates,
      ) !== list.data
    ) {
      problems.push(`${list.current.zone}: data inputs changed during execution`);
    }
    if (sha256(list.contents) !== list.sha256 || !same(JSON.parse(list.contents), list.current)) {
      problems.push(`${list.current.zone}: frozen preimage changed`);
    }
  }
  const proposed =
    problems.length === 0
      ? plan.lists.map(({ current, data }) => ({
          ...current,
          arenas: current.arenas.map(({ id }) => arenas.get(keyOf(current.zone, id))!),
          entries: current.entries.map(({ id }) => entries.get(keyOf(current.zone, id))!),
          inputs: { data, proofs: plan.proofs },
        }))
      : undefined;
  return {
    differences,
    preimages: plan.lists,
    problems,
    ...(proposed !== undefined && { proposed }),
    results,
    status: problems.length > 0 || differences.length > 0 ? "blocked" : "proposal",
  };
}
