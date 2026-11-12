import { expect, it } from "vitest";

import { type ArenaProof, certifiedArena, summariseArenaEvidence } from "./arenaCertify.ts";
import { gameArenaCase } from "./arenas.ts";
import { ARENA_SAMPLES } from "./arenaSamples.ts";
import { EVADE_SLOWED, type EvadeRun } from "./evade.ts";

const run = (overrides: Partial<EvadeRun> = {}): EvadeRun => ({
  acquired: 0,
  ...(overrides.death ? {} : { exit: 8 }),
  free: 4,
  levels: 1,
  problems: [],
  seed: 0,
  start: "entry",
  switches: 0,
  trace: "fixed:1",
  work: 100,
  ...overrides,
});

it("leaves later evidence unassessed when the static boundary rejects an arena", () => {
  const evidence = summariseArenaEvidence(EVADE_SLOWED, {
    staticProblems: ["exit seam blocked"],
  });
  expect(evidence.static).toEqual({ problems: ["exit seam blocked"], status: "failed" });
  expect(evidence.functional).toEqual({
    evade: { status: "not_evaluated" },
    pathOut: { status: "not_evaluated" },
    requiredRoutes: { status: "not_evaluated" },
  });
  expect(evidence.challenge).toEqual({ status: "not_evaluated" });
  expect(evidence.humanPlayability).toEqual({ status: "not_evaluated" });
});

it("separates functional passage from the bot slowdown challenge without inventing search facts", () => {
  const runs = Array.from({ length: 8 }, (_, seed) => run({ exit: 5, seed }));
  const evidence = summariseArenaEvidence(EVADE_SLOWED, {
    evade: { repeatedStarts: [], runs, slowedRuns: 0 },
    pathOut: { problems: [] },
    requiredRoutes: { problems: [], profiles: 2 },
    staticProblems: [],
  });
  expect(evidence.functional).toEqual({
    evade: {
      aliveExits: 8,
      deaths: 0,
      repeatedStarts: [],
      runs: 8,
      runsWithProblems: 0,
      searchUnknown: "not_recorded",
      status: "passed",
      work: 800,
    },
    pathOut: { problems: [], status: "passed" },
    requiredRoutes: { problems: [], profiles: 2, status: "passed" },
  });
  expect(evidence.challenge).toEqual({
    requiredRuns: EVADE_SLOWED.runs,
    seconds: EVADE_SLOWED.seconds,
    slowedRuns: 0,
    status: "failed",
  });
  expect(evidence.humanPlayability.status).toBe("not_evaluated");
});

it("retains failures independently of sufficient slowdown and copies input problem lists", () => {
  const routeProblems = ["empty: required routes incomplete"];
  const repeatedStarts = ["evade mid seed 0: repeats the entry run"];
  const runs = [
    ...Array.from({ length: 7 }, (_, seed) => run({ seed })),
    run({ death: "body", problems: ["body"], seed: 7 }),
  ];
  const evidence = summariseArenaEvidence(EVADE_SLOWED, {
    evade: { repeatedStarts, runs, slowedRuns: EVADE_SLOWED.runs },
    pathOut: { problems: ["no pursuing boss"] },
    requiredRoutes: { problems: routeProblems, profiles: 1 },
    staticProblems: [],
  });
  expect(evidence.functional.requiredRoutes.status).toBe("failed");
  expect(evidence.functional.pathOut.status).toBe("failed");
  expect(evidence.functional.evade).toEqual({
    aliveExits: 7,
    deaths: 1,
    repeatedStarts: [...repeatedStarts],
    runs: 8,
    runsWithProblems: 1,
    searchUnknown: "not_recorded",
    status: "failed",
    work: 800,
  });
  expect(evidence.challenge.status).toBe("passed");
  expect(routeProblems).toEqual(["empty: required routes incomplete"]);
  expect(runs[7]!.problems).toEqual(["body"]);
  routeProblems.push("later mutation");
  repeatedStarts.push("later mutation");
  expect(evidence.functional.requiredRoutes).toEqual({
    problems: ["empty: required routes incomplete"],
    profiles: 1,
    status: "failed",
  });
  if (evidence.functional.evade.status !== "not_evaluated") {
    expect(evidence.functional.evade.repeatedStarts).toHaveLength(1);
  }
});

it("keeps the persisted certificate shape and recorded hash independent of descriptive evidence", () => {
  const found = gameArenaCase(ARENA_SAMPLES[0]!);
  const proof: ArenaProof = {
    evidence: summariseArenaEvidence(EVADE_SLOWED, { staticProblems: [] }),
    hash: "recorded-proof-hash",
    problems: [],
    trace: "route:1",
    work: 1,
  };
  const original = certifiedArena(found, proof);
  const changed = certifiedArena(found, {
    ...proof,
    evidence: summariseArenaEvidence(EVADE_SLOWED, { staticProblems: ["different report"] }),
  });
  expect(changed).toEqual(original);
  expect(original).toEqual({ hash: proof.hash, id: found.arena.id, stage: found.arena.stage });
  expect(JSON.stringify(changed)).toBe(JSON.stringify(original));
});
