import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { traceRecorder } from "../ai/index.ts";
import { BIRD } from "../data/bird.ts";
import type {
  ArenaApproachPolicy,
  CertifiedArenaApproach,
  ZoneRecipe,
} from "../data/types/index.ts";
import { arenaApproachProblems } from "../rules/arenaApproaches.ts";
import { DIAGNOSTIC_SKILL, FORWARD_POLICY, NAVIGATION_DEFAULTS } from "../sim/bot.ts";
import type { PreparedStage, RunResult, SimulationConfig } from "../sim/simulate.ts";
import type { SimulationStart } from "../sim/start.ts";

export interface ColdEncounter {
  readonly area: string;
  readonly arenaId: string;
  readonly arenaIndex: number;
  readonly bossIndex: number;
  readonly start: Extract<SimulationStart, { readonly x: number }>;
}

// The full body starts on the predecessor's unique static support, immediately before the seam.
export function firstArenaEncounter(
  stage: Pick<PreparedStage, "layout" | "source">,
): ColdEncounter {
  const areaName = stage.layout.start.area;
  const area = stage.layout.areas[areaName]!;
  const ids = stage.source?.chunkIds?.[areaName];
  const arenaIndex = ids?.findIndex((id) => id.startsWith("arena-")) ?? -1;
  const arena = area.chunks[arenaIndex];
  const predecessor = area.chunks[arenaIndex - 1];
  if (!arena || !predecessor || predecessor.x + predecessor.width !== arena.x) {
    throw new Error("City first arena has no contiguous predecessor");
  }
  const x = arena.x - BIRD.width;
  const supports = area.solids.filter((rect) => rect.x <= x && rect.x + rect.width >= arena.x);
  if (supports.length !== 1) {
    throw new Error("City approach requires one full-body static support");
  }
  const bosses = area.objects.flatMap((object, index) =>
    object.character === "dog-antagonist" &&
    object.origin.x >= arena.x &&
    object.origin.x < arena.x + arena.width
      ? [index]
      : [],
  );
  if (bosses.length !== 1) {
    throw new Error("City first arena requires one dog");
  }
  return {
    area: areaName,
    arenaId: ids![arenaIndex]!,
    arenaIndex,
    bossIndex: bosses[0]!,
    start: { area: areaName, x, y: supports[0]!.y - BIRD.height },
  };
}

export const COLD_ENCOUNTER_CASE = { maxRetries: 2, maxSteps: 3600, seed: 2 } as const;

// The unchanged canonical City case uses this same config for its test and evidence validator.
export function coldEncounterConfig(encounter: ColdEncounter): SimulationConfig {
  return {
    ...COLD_ENCOUNTER_CASE,
    policy: { ...FORWARD_POLICY, jump: "planned" },
    skill: { ...DIAGNOSTIC_SKILL, navigation: NAVIGATION_DEFAULTS },
    start: encounter.start,
    trace: {
      maxEvents: COLD_ENCOUNTER_CASE.maxSteps,
      sampleEveryTicks: 1,
      stallTicks: COLD_ENCOUNTER_CASE.maxSteps,
    },
  };
}

// cold-encounter-v1 measures the current City dog case, including automatic in-case retries.
// The shared assembly relation imposes no such behaviour on other boss kinds.
export function coldEncounterFacts(encounter: ColdEncounter, result: RunResult) {
  const states = [...result.trace, result.terminal].flatMap((event) =>
    event.area === encounter.area
      ? event.nearby.objects.flatMap((object) =>
          object.index === encounter.bossIndex &&
          object.character === "dog-antagonist" &&
          object.active
            ? [object.stateKey]
            : [],
        )
      : [],
  );
  return {
    arenaVisited: result.coverage.path.some(
      (entry) =>
        entry.area === encounter.area &&
        entry.chunk === encounter.arenaIndex &&
        entry.chunkId === encounter.arenaId,
    ),
    attacked: states.some((state) => state === "rush" || state === "pounce"),
    pursued: states.includes("pursuit"),
    traceRetained: result.traceDropped === 0,
  };
}

export function arenaApproachContext(
  context: { readonly encounter: ColdEncounter; readonly hash: (value: unknown) => string },
  prepared: Pick<PreparedStage, "layout" | "source">,
): Pick<CertifiedArenaApproach["evidence"], "arenaIndex" | "bossIndex" | "plan"> {
  return {
    arenaIndex: context.encounter.arenaIndex,
    bossIndex: context.encounter.bossIndex,
    plan: context.hash({ chunks: prepared.source?.chunkIds, layout: prepared.layout }),
  };
}

// Audit inputs exclude this output. Qualification consumes the existing canonical result.
export function qualifyArenaApproach(
  context: {
    readonly hash: (value: unknown) => string;
    readonly inputs: CertifiedArenaApproach["inputs"];
    readonly policy: ArenaApproachPolicy;
    readonly stage: string;
    readonly trace: string;
  },
  prepared: PreparedStage,
  result: RunResult,
): CertifiedArenaApproach {
  const encounter = firstArenaEncounter(prepared);
  const facts = coldEncounterFacts(encounter, result);
  const ids = prepared.source?.chunkIds?.[encounter.area];
  const predecessor = ids?.[encounter.arenaIndex - 1];
  if (
    context.stage !== "city-boundary" ||
    result.seed !== COLD_ENCOUNTER_CASE.seed ||
    !Number.isSafeInteger(result.retries) ||
    result.retries < 0 ||
    result.retries > COLD_ENCOUNTER_CASE.maxRetries ||
    context.hash(result.config) !== context.hash(coldEncounterConfig(encounter)) ||
    context.hash(result.tuning) !== context.hash(BIRD) ||
    context.policy.profile !== "cold-encounter-v1" ||
    context.policy.predecessors.length !== 1 ||
    predecessor !== context.policy.predecessors[0] ||
    !Object.values(facts).every(Boolean) ||
    result.seed !== prepared.source?.layoutSeed ||
    prepared.source?.provenance?.data === undefined ||
    result.provenance.data !== prepared.source.provenance.data ||
    result.start.area !== encounter.start.area ||
    result.start.x !== encounter.start.x ||
    result.start.y !== encounter.start.y ||
    !/^[a-f0-9]{16}:[1-9][0-9]*$/u.test(context.trace)
  ) {
    throw new Error("Arena approach lacks matching canonical cold-encounter evidence");
  }
  return {
    arena: encounter.arenaId,
    evidence: {
      ...arenaApproachContext({ encounter, hash: context.hash }, prepared),
      retries: result.retries,
      seed: result.seed,
      trace: context.trace,
    },
    inputs: context.inputs,
    predecessors: [...context.policy.predecessors],
    profile: context.policy.profile,
    stage: context.stage,
  };
}

export function arenaApproachCertificateProblems(
  context: {
    readonly inputs: CertifiedArenaApproach["inputs"];
    readonly stages: readonly {
      readonly arena: string | undefined;
      readonly eligible: readonly string[];
      readonly recipe: ZoneRecipe;
      readonly stage: string;
      readonly expected: (
        seed: number,
      ) => Pick<CertifiedArenaApproach["evidence"], "plan" | "arenaIndex" | "bossIndex" | "trace">;
    }[];
  },
  records: readonly CertifiedArenaApproach[],
): string[] {
  const problems: string[] = [];
  const stages = new Set<string>();
  for (const record of records) {
    const stage = context.stages.find(({ stage }) => stage === record.stage);
    if (record.stage !== "city-boundary") {
      problems.push(`${record.stage}: cold-encounter-v1 only measures the current City case`);
    }
    if (stages.has(record.stage)) {
      problems.push(`Repeated arena approach stage ${record.stage}`);
    }
    stages.add(record.stage);
    if (stage?.recipe.arenaApproach === undefined) {
      problems.push(`Arena approach ${record.stage} has no declared policy`);
      continue;
    }
    problems.push(...arenaApproachProblems(stage, stage.recipe.arenaApproach, record));
    if (
      record.inputs.data !== context.inputs.data ||
      record.inputs.proofs !== context.inputs.proofs
    ) {
      problems.push(`${record.stage}: arena approach evidence is stale`);
    }
    const evidence = record.evidence;
    if (
      evidence.seed !== COLD_ENCOUNTER_CASE.seed ||
      !Number.isSafeInteger(evidence.retries) ||
      evidence.retries < 0 ||
      evidence.retries > COLD_ENCOUNTER_CASE.maxRetries ||
      !Number.isSafeInteger(evidence.arenaIndex) ||
      evidence.arenaIndex < 1 ||
      !Number.isSafeInteger(evidence.bossIndex) ||
      evidence.bossIndex < 0 ||
      !/^[a-f0-9]{16}$/u.test(evidence.plan) ||
      !/^[a-f0-9]{16}:[1-9][0-9]*$/u.test(evidence.trace)
    ) {
      problems.push(`${record.stage}: invalid arena approach evidence`);
    } else {
      try {
        const expected = stage.expected(evidence.seed);
        if (
          evidence.plan !== expected.plan ||
          evidence.arenaIndex !== expected.arenaIndex ||
          evidence.bossIndex !== expected.bossIndex ||
          evidence.trace !== expected.trace
        ) {
          problems.push(`${record.stage}: arena approach context is stale`);
        }
      } catch (error) {
        problems.push(`${record.stage}: invalid arena approach context: ${String(error)}`);
      }
    }
  }
  for (const { recipe, stage } of context.stages) {
    if (recipe.arenaApproach !== undefined && !stages.has(stage)) {
      problems.push(`${stage}: missing arena approach qualification`);
    }
  }
  return problems;
}

// Read the canonical recorder output, including speculative steps; never replay the result.
export async function canonicalApproachTrace(
  context: Pick<RunResult, "steps">,
  subject: string,
): Promise<string> {
  const recorder = traceRecorder({ retain: false });
  const lines = createInterface({ crlfDelay: Infinity, input: createReadStream(subject) });
  for await (const line of lines) {
    recorder.record(line);
  }
  if (
    !Number.isSafeInteger(context.steps) ||
    context.steps < 1 ||
    recorder.ticks() < context.steps
  ) {
    throw new Error("Canonical raw trace does not cover the returned physical steps");
  }
  return recorder.hash();
}

export function coldEncounterBaselineTrace(): string {
  const traces = JSON.parse(
    readFileSync(new URL("../sim/fixtures/behaviourTraces/stages.json", import.meta.url), "utf8"),
  ) as Readonly<Record<string, string>>;
  const trace = traces["stage city-boundary seed 2 planned"];
  if (trace === undefined) {
    throw new Error("Missing canonical City cold-encounter baseline");
  }
  return trace;
}
