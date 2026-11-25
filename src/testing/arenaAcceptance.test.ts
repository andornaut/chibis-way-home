import { expect, it } from "vitest";

import { CERTIFIED_LISTS } from "../data/certified/index.ts";
import {
  ACCEPTANCE_ARENAS,
  ACCEPTANCE_FAILURES,
  ACCEPTANCE_TARGETS,
  type AcceptanceTarget,
  acceptanceProblems,
  missedTargets,
} from "./arenaAcceptance.ts";
import { summariseArenaEvidence } from "./arenaCertify.ts";
import { EVADE_SEEDS, EVADE_SLOWED, EVADE_STARTS, type EvadeRun } from "./evade.ts";

const RUNS = EVADE_SEEDS.length * EVADE_STARTS.length;
const run = (problems: readonly string[] = [], death?: string) =>
  ({ death, exit: death === undefined ? 30 : undefined, problems, work: 0 }) as unknown as EvadeRun;

// The evidence of a proof with the given evade runs and slowed count, every other check passing.
const evidence = (runs: readonly EvadeRun[], slowedRuns: number, staticProblems: string[] = []) =>
  summariseArenaEvidence(EVADE_SLOWED, {
    evade: { repeatedStarts: [], runs, slowedRuns },
    pathOut: { problems: [] },
    requiredRoutes: { problems: [], profiles: 1 },
    staticProblems,
  });
const passing = () => Array.from({ length: RUNS }, () => run());

it("batches exactly the arenas the certified lists admit", () => {
  expect([...ACCEPTANCE_ARENAS].sort()).toEqual(
    CERTIFIED_LISTS.flatMap(({ arenas }) => arenas.map(({ id }) => id)).sort(),
  );
});

it("lists failures only for batched arenas and named targets", () => {
  for (const { arena, target } of ACCEPTANCE_FAILURES) {
    expect(ACCEPTANCE_ARENAS).toContain(arena);
    expect(Object.keys(ACCEPTANCE_TARGETS)).toContain(target);
  }
});

it.each<[AcceptanceTarget, ReturnType<typeof evidence>]>([
  ["alive-exits", evidence([...passing().slice(1), run([], "boss")], EVADE_SLOWED.runs)],
  ["alive-exits", evidence([...passing().slice(1), run(["exit after the limit"])], RUNS)],
  ["evade-runs", evidence(passing().slice(1), EVADE_SLOWED.runs)],
  ["slowed", evidence(passing(), EVADE_SLOWED.runs - 1)],
  ["static", evidence(passing(), RUNS, ["no loop route"])],
])("misses %s when its evidence falls short", (target, falling) => {
  expect(missedTargets({ evidence: evidence(passing(), EVADE_SLOWED.runs) })).toEqual([]);
  expect(missedTargets({ evidence: falling })).toContain(target);
});

it("fails an unlisted miss, a listed failure now met and a missing arena", () => {
  const met = ACCEPTANCE_ARENAS.map((arena) => ({ arena, missed: [] }));
  expect(acceptanceProblems([], met)).toEqual([]);
  const [first, ...rest] = met;
  const missed = [{ ...first!, missed: ["slowed" as const] }, ...rest];
  expect(acceptanceProblems([], missed)).toEqual([
    `${first!.arena} misses slowed: ${ACCEPTANCE_TARGETS.slowed}`,
  ]);
  const listed = [{ arena: first!.arena, cause: "fixture", target: "slowed" as const }];
  expect(acceptanceProblems(listed, missed)).toEqual([]);
  expect(acceptanceProblems(listed, met)).toEqual([
    `${first!.arena} now meets slowed; remove its acceptance failure`,
  ]);
  expect(acceptanceProblems([], rest)).toHaveLength(1);
});
