import { expect, it } from "vitest";

import { CERTIFIED_LISTS } from "../data/certified/index.ts";
import {
  ACCEPTANCE_ARENAS,
  ACCEPTANCE_FAILURES,
  ACCEPTANCE_TARGETS,
  acceptanceProblems,
  type AcceptanceTarget,
  missedTargets,
} from "./arenaAcceptance.ts";
import { summariseArenaEvidence } from "./arenaCertify.ts";
import {
  ACCEPTANCE_CONNECTORS,
  connectorCases,
  missedConnectorTargets,
} from "./connectorAcceptance.ts";
import type { ConnectorRoute } from "./connectorRoute.ts";
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

it("lists failures only for batched subjects and named targets", () => {
  for (const { subject, target } of ACCEPTANCE_FAILURES) {
    expect([...ACCEPTANCE_ARENAS, ...ACCEPTANCE_CONNECTORS]).toContain(subject);
    expect(Object.keys(ACCEPTANCE_TARGETS)).toContain(target);
  }
});

it("crosses every batched connector in at least one zone that lists it", () => {
  const crossed = new Set(connectorCases(ACCEPTANCE_CONNECTORS).map(({ connector }) => connector));
  expect([...crossed].sort()).toEqual([...ACCEPTANCE_CONNECTORS].sort());
});

it.each<[string, Partial<ConnectorRoute>]>([
  ["a death", { death: { reason: "hazard" } as ConnectorRoute["death"] }],
  ["an air jump", { airJumped: true }],
  ["a gate it never passed", { passedGate: false }],
  ["no clear", { cleared: false }],
])("misses ordinary-route on %s", (_, change) => {
  const route: ConnectorRoute = {
    airJumped: false,
    cleared: true,
    death: undefined,
    gate: true,
    index: 1,
    passedGate: true,
    ticks: 1,
    x: 0,
    y: 0,
  };
  expect(missedConnectorTargets(route)).toEqual([]);
  expect(missedConnectorTargets({ ...route, ...change })).toEqual(["ordinary-route"]);
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

it("fails an unlisted miss, a listed failure now met and a missing subject", () => {
  const subjects = [...ACCEPTANCE_ARENAS, ...ACCEPTANCE_CONNECTORS];
  const met = subjects.map((subject) => ({ missed: [], subject }));
  expect(acceptanceProblems(subjects, [], met)).toEqual([]);
  const [first, ...rest] = met;
  const missed = [{ ...first!, missed: ["slowed" as const] }, ...rest];
  expect(acceptanceProblems(subjects, [], missed)).toEqual([
    `${first!.subject} misses slowed: ${ACCEPTANCE_TARGETS.slowed}`,
  ]);
  const listed = [{ cause: "fixture", subject: first!.subject, target: "slowed" as const }];
  expect(acceptanceProblems(subjects, listed, missed)).toEqual([]);
  expect(acceptanceProblems(subjects, listed, met)).toEqual([
    `${first!.subject} now meets slowed; remove its acceptance failure`,
  ]);
  expect(acceptanceProblems(subjects, [], rest)).toHaveLength(1);
});
