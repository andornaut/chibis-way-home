import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { traceRecorder } from "../ai/trace.ts";
import { BIRD } from "../data/bird.ts";
import type { ArenaApproachPolicy, ZoneRecipe } from "../data/types/index.ts";
import { prepareStage, type RunResult } from "../sim/simulate.ts";
import {
  arenaApproachCertificateProblems,
  canonicalApproachTrace,
  coldEncounterConfig,
  coldEncounterFacts,
  firstArenaEncounter,
  qualifyArenaApproach,
} from "./arenaApproaches.ts";
import { chunksLayout } from "./encounterLayouts.ts";
import { hashOf } from "./pairCertify.ts";

const ids = ["outdoor-deep-ascent", "arena-dog-city-boundary"];
const prepared = {
  ...prepareStage(chunksLayout("city-boundary", ids)),
  source: { chunkIds: { main: ids }, layoutSeed: 2, provenance: { data: "sha256:fixture" } },
};
const encounter = firstArenaEncounter(prepared);
const policy: ArenaApproachPolicy = { predecessors: [ids[0]!], profile: "cold-encounter-v1" };
const inputs = { data: "fixture-data", proofs: "fixture-proofs" };
// Only fields consumed by the passive evidence validator are supplied; no simulation is run.
const sample = (stateKey: "pursuit" | "rush", attempt: number) => ({
  area: "main",
  attempt,
  nearby: {
    objects: [{ active: true, character: "dog-antagonist", index: encounter.bossIndex, stateKey }],
  },
});
const result = {
  config: coldEncounterConfig(encounter),
  coverage: { path: [{ area: "main", chunk: encounter.arenaIndex, chunkId: encounter.arenaId }] },
  provenance: prepared.source.provenance,
  retries: 1,
  seed: 2,
  start: encounter.start,
  terminal: { area: "other", nearby: { objects: [] } },
  trace: [sample("pursuit", 0), sample("rush", 1)],
  traceDropped: 0,
  tuning: BIRD,
} as unknown as RunResult;
const context = {
  hash: hashOf,
  inputs,
  policy,
  stage: "city-boundary",
  trace: "0123456789abcdef:2",
};

it("qualifies the existing aggregate retry semantics and records the actual resolved context", () => {
  const relation = qualifyArenaApproach(context, prepared, result);
  expect(coldEncounterFacts(encounter, result)).toEqual({
    arenaVisited: true,
    attacked: true,
    pursued: true,
    traceRetained: true,
  });
  expect(relation.evidence).toMatchObject({
    arenaIndex: 1,
    bossIndex: encounter.bossIndex,
    plan: hashOf({ chunks: prepared.source.chunkIds, layout: prepared.layout }),
    retries: 1,
    seed: 2,
  });
});

it("rejects missing attack, dropped samples and evidence from a different prepared world", () => {
  expect(() =>
    qualifyArenaApproach(context, prepared, { ...result, trace: [result.trace[0]!] }),
  ).toThrow("matching canonical cold-encounter evidence");
  expect(() => qualifyArenaApproach(context, prepared, { ...result, traceDropped: 1 })).toThrow(
    "matching canonical cold-encounter evidence",
  );
  expect(() =>
    qualifyArenaApproach(context, prepared, { ...result, provenance: { data: "other" } }),
  ).toThrow("matching canonical cold-encounter evidence");
});

it("rejects stale input headers or a different materialized plan without interpreting hashes as proof", () => {
  const relation = qualifyArenaApproach(context, prepared, result);
  const stage = {
    arena: encounter.arenaId,
    eligible: ids,
    expected: () => relation.evidence,
    recipe: { arenaApproach: policy } as ZoneRecipe,
    stage: "city-boundary",
  };
  expect(arenaApproachCertificateProblems({ inputs, stages: [stage] }, [relation])).toEqual([]);
  expect(arenaApproachCertificateProblems({ inputs, stages: [stage] }, [])).toContain(
    "city-boundary: missing arena approach qualification",
  );
  expect(
    arenaApproachCertificateProblems({ inputs, stages: [stage] }, [
      { ...relation, inputs: { ...inputs, data: "stale" } },
    ]),
  ).toContain("city-boundary: arena approach evidence is stale");
  expect(
    arenaApproachCertificateProblems({ inputs, stages: [stage] }, [
      { ...relation, evidence: { ...relation.evidence, plan: "1111111111111111" } },
    ]),
  ).toContain("city-boundary: arena approach context is stale");
  expect(
    arenaApproachCertificateProblems({ inputs, stages: [stage] }, [
      {
        ...relation,
        evidence: { ...relation.evidence, trace: "1111111111111111" },
      },
    ]),
  ).toContain("city-boundary: invalid arena approach evidence");
  expect(
    arenaApproachCertificateProblems({ inputs, stages: [stage] }, [
      {
        ...relation,
        evidence: { ...relation.evidence, seed: 3 },
      },
    ]),
  ).toContain("city-boundary: invalid arena approach evidence");
  expect(
    arenaApproachCertificateProblems({ inputs, stages: [stage] }, [
      {
        ...relation,
        evidence: { ...relation.evidence, retries: 3 },
      },
    ]),
  ).toContain("city-boundary: invalid arena approach evidence");
});

it("rejects changed canonical budgets, seed and tuning rather than accepting easier imported evidence", () => {
  expect(() =>
    qualifyArenaApproach(context, prepared, {
      ...result,
      config: { ...result.config, maxSteps: 7200 },
    }),
  ).toThrow("matching canonical cold-encounter evidence");
  expect(() =>
    qualifyArenaApproach(context, prepared, {
      ...result,
      seed: 3,
    }),
  ).toThrow("matching canonical cold-encounter evidence");
  expect(() =>
    qualifyArenaApproach(context, prepared, {
      ...result,
      tuning: { ...BIRD, width: BIRD.width + 1 },
    }),
  ).toThrow("matching canonical cold-encounter evidence");
});

it("imports each canonical recorder line once and rejects a trace shorter than actual physical work", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "approach-trace-")), "canonical.trace");
  const lines = ['{"actual":1}', '{"prediction":2}'];
  writeFileSync(file, `${lines.join("\n")}\n`);
  const expected = traceRecorder({ retain: false });
  for (const line of lines) {
    expected.record(line);
  }
  await expect(canonicalApproachTrace({ steps: 1 }, file)).resolves.toBe(expected.hash());
  await expect(canonicalApproachTrace({ steps: 1 }, file)).resolves.toMatch(/^[a-f0-9]{16}:2$/u);
  await expect(canonicalApproachTrace({ steps: 3 }, file)).rejects.toThrow("does not cover");
});
