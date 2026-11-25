import { mkdirSync, writeFileSync } from "node:fs";

import { expect, it, vi } from "vitest";

import { traceRecorder } from "../ai/index.ts";
import { BIRD } from "../data/bird.ts";
import {
  COLD_ENCOUNTER_CASE,
  coldEncounterConfig,
  coldEncounterFacts,
  firstArenaEncounter,
} from "../testing/arenaApproaches.ts";
import { TRACE } from "../testing/behaviourTraceHook.ts";
import { simulateStage, stageLoader } from "./index.ts";

vi.mock("../rules/zone/zone.ts", async (original) =>
  (await import("../testing/behaviourTraceHook.ts")).tracedZone(await original()),
);

// City Boundary's cold encounter, the canonical case of its certified arena approach: Chibi starts
// before the generated first arena's seam and the actual dog pursues and attacks him.
// BEHAVIOUR_TRACE_DUMP=<dir> writes the run's raw zone trace and result, the evidence
// `npm run pairs -- qualify-approach` reads.
const DUMP = process.env.BEHAVIOUR_TRACE_DUMP;
const NAME = `stage_city-boundary_seed_${COLD_ENCOUNTER_CASE.seed}_planned`;

it("visits City Boundary's first arena from a cold start, where the dog pursues and attacks", () => {
  const prepared = stageLoader("city-boundary")(COLD_ENCOUNTER_CASE.seed);
  const encounter = firstArenaEncounter(prepared);
  const recorder = traceRecorder({ retain: DUMP !== undefined });
  TRACE.active = recorder;
  let result: ReturnType<typeof simulateStage>;
  try {
    result = simulateStage(BIRD, prepared, coldEncounterConfig(encounter));
  } finally {
    TRACE.active = undefined;
  }
  if (DUMP !== undefined) {
    mkdirSync(DUMP, { recursive: true });
    writeFileSync(`${DUMP}/${NAME}.trace`, `${recorder.lines()!.join("\n")}\n`);
    writeFileSync(`${DUMP}/${NAME}.result.json`, `${JSON.stringify(result, null, 2)}\n`);
  }
  expect(recorder.ticks()).toBeGreaterThan(0);
  expect(coldEncounterFacts(encounter, result)).toEqual({
    arenaVisited: true,
    attacked: true,
    pursued: true,
    traceRetained: true,
  });
}, 600_000);
