import { beforeAll, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ arena: vi.fn(), entry: vi.fn() }));
vi.mock("./arenaCertify.ts", async (original) => ({
  ...(await original<typeof import("./arenaCertify.ts")>()),
  proveArena: native.arena,
}));
vi.mock("./pairCertify.ts", async (original) => ({
  ...(await original<typeof import("./pairCertify.ts")>()),
  proveForProfile: native.entry,
}));

import { CERTIFIED_LISTS } from "../data/certified/index.ts";
import type { CertifiedChunks, OrdinaryProofProfile } from "../data/types/index.ts";
import {
  completeCurrentListProposal,
  type CurrentListPreimage,
  type CurrentListProposalPlan,
  type CurrentListResult,
  prepareCurrentListProposal,
} from "./currentListCertification.ts";

const current = CERTIFIED_LISTS.map((list) => ({
  ...list,
  entries:
    list.zone === "industrial"
      ? [
          list.entries.find(({ proof }) => proof === undefined)!,
          list.entries.find(({ proof }) => proof !== undefined)!,
        ].sort((a, b) => a.id.localeCompare(b.id))
      : list.entries.slice(0, 1),
}));
const preimages = (): CurrentListPreimage[] =>
  current.map((list) => ({ contents: JSON.stringify(list), zone: list.zone }));
let plan: CurrentListProposalPlan;
beforeAll(() => {
  plan = prepareCurrentListProposal(preimages());
}, 60_000);

// These are synthetic producer results. This suite never executes a native proof.
const results = (): CurrentListResult[] =>
  plan.jobs.map((job) => {
    const identity = { id: job.previous.id, zone: job.zone };
    if (job.kind === "entry") {
      return {
        ...identity,
        kind: "entry",
        proof: {
          problems: [],
          trace: job.previous.trace,
          work: job.previous.work,
          ...(job.previous.proof !== undefined && { proof: job.previous.proof }),
        },
      };
    }
    return {
      ...identity,
      kind: "arena",
      proof: {
        evidence: {
          challenge: { requiredRuns: 6, seconds: 3, slowedRuns: 6, status: "passed" },
          functional: {
            evade: {
              aliveExits: 8,
              deaths: 0,
              repeatedStarts: [],
              runs: 8,
              runsWithProblems: 0,
              searchUnknown: "not_recorded",
              status: "passed",
              work: 1,
            },
            pathOut: { problems: [], status: "passed" },
            requiredRoutes: { problems: [], profiles: 1, status: "passed" },
          },
          humanPlayability: { status: "not_evaluated" },
          static: { problems: [], status: "passed" },
        },
        hash: job.previous.hash,
        problems: [],
        trace: "0000000000000000:1",
        work: 1,
      },
    };
  });

it("freezes only recorded mixed-profile entries and arena identities without invoking producers", () => {
  expect(plan.jobs.map(({ previous, zone }) => [zone, previous.id])).toEqual(
    current.flatMap((list) => [...list.entries, ...list.arenas].map(({ id }) => [list.zone, id])),
  );
  const entryJobs = plan.jobs.filter((job) => job.kind === "entry");
  expect(entryJobs.some(({ previous }) => previous.proof === undefined)).toBe(true);
  expect(entryJobs.some(({ previous }) => previous.proof?.kind === "ordinary")).toBe(true);
  expect(native.arena).not.toHaveBeenCalled();
  expect(native.entry).not.toHaveBeenCalled();
});

it("rejects missing zones, duplicate or unknown IDs, changed facts and invalid profiles before dispatch", () => {
  expect(() => prepareCurrentListProposal(preimages().slice(1))).toThrow("every zone");
  const first = current[0]!;
  for (const entries of [
    [first.entries[0]!, first.entries[0]!],
    [{ ...first.entries[0]!, id: "unknown" }],
    [{ ...first.entries[0]!, layout: "changed" }],
    [
      {
        ...first.entries[0]!,
        proof: { kind: "ordinary", tuning: "wrong", version: 1 } as OrdinaryProofProfile,
      },
    ],
  ]) {
    const invalid = preimages();
    invalid[0] = { contents: JSON.stringify({ ...first, entries }), zone: first.zone };
    expect(() => prepareCurrentListProposal(invalid)).toThrow();
  }
  expect(native.arena).not.toHaveBeenCalled();
  expect(native.entry).not.toHaveBeenCalled();
}, 60_000);

it("blocks missing, failed, exceptional, duplicate and converted-profile results without partial proposals", () => {
  const all = results();
  const first = all.find((result) => result.kind === "entry")!;
  if (first.kind !== "entry") {
    throw new Error("No fixture entry");
  }
  for (const actual of [
    all.slice(1),
    [...all, first],
    all.map((result) =>
      result === first ? { ...first, proof: { ...first.proof, problems: ["incomplete"] } } : result,
    ),
    all.map((result) =>
      result === first
        ? { error: "worker failed", id: first.id, kind: "error" as const, zone: first.zone }
        : result,
    ),
    all.map((result) =>
      result === first
        ? {
            ...first,
            proof: {
              ...first.proof,
              proof: { kind: "ordinary" as const, tuning: "wrong", version: 1 as const },
            },
          }
        : result,
    ),
  ]) {
    const proposal = completeCurrentListProposal(plan, actual);
    expect(proposal.status).toBe("blocked");
    expect(proposal.problems.length).toBeGreaterThan(0);
    expect(proposal).not.toHaveProperty("proposed");
    expect(proposal.results).toBe(actual);
  }
}, 60_000);

it("preserves all facts and preimages, and blocks field-level trace, work and arena hash differences", () => {
  const before = JSON.stringify(plan);
  const actual = results();
  const clean = completeCurrentListProposal(plan, actual);
  expect(clean.status).toBe("proposal");
  expect(clean.proposed?.map(({ arenas, entries }) => ({ arenas, entries }))).toEqual(
    current.map(({ arenas, entries }) => ({ arenas, entries })),
  );
  expect(clean.proposed?.map(({ inputs }) => inputs.proofs)).toEqual(
    current.map(() => plan.proofs),
  );
  const changed = actual.map((result): CurrentListResult =>
    result.kind === "entry"
      ? {
          ...result,
          proof: {
            ...result.proof,
            trace: `0000000000000000:${result.proof.work + 1}`,
            work: result.proof.work + 1,
          },
        }
      : result.kind === "arena"
        ? { ...result, proof: { ...result.proof, hash: "0000000000000000" } }
        : result,
  );
  const blocked = completeCurrentListProposal(plan, changed);
  expect(blocked.status).toBe("blocked");
  expect(blocked.problems).toEqual([]);
  expect(new Set(blocked.differences.map(({ field }) => field))).toEqual(
    new Set(["trace", "work", "hash"]),
  );
  expect(blocked.results).toBe(changed);
  expect(JSON.stringify(plan)).toBe(before);
  expect(plan.lists.map(({ current }) => current)).toEqual(current as readonly CertifiedChunks[]);
}, 60_000);
