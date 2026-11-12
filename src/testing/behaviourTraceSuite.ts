import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import { traceRecorder } from "../ai/trace.ts";
import { BIRD_FRAME } from "../assets/index.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { BIRD } from "../data/bird.ts";
import { TILE } from "../data/screen.ts";
import type { ZoneLayout } from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { zoneLayout } from "../rules/tiles.ts";
import {
  activateBehaviour,
  retryZone,
  startZone,
  stepZone,
  type ZoneState,
} from "../rules/zone.ts";
import { DIAGNOSTIC_SKILL, FORWARD_POLICY, NAVIGATION_DEFAULTS } from "../sim/bot.ts";
import { stageLoader } from "../sim/catalogue.ts";
import { simulateStage } from "../sim/simulate.ts";
import { walkRequiredRoutes, walkZone } from "../sim/zoneWalk.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "./art.ts";
import { TRACE } from "./behaviourTraceHook.ts";
import { ALL_CHUNKS } from "./chunks.ts";
import { chunkWalkPlan } from "./chunkWalkCases.ts";
import { chunkWalkPartitions } from "./chunkWalkPartitions.ts";
import {
  chunkLayout,
  ENCOUNTER_SCRIPTS,
  ENCOUNTER_TICKS,
  type EncounterScript,
  liftLayout,
  liftLowerDockStart,
  ORDINARY,
} from "./encounterLayouts.ts";
import { FILLED_CHUNK_SLOTS, REQUIRED_CHUNK_ROUTES } from "./requiredRoutes.ts";

// Each scenario must be deterministic: fixed seeds, fixed inputs and no wall-clock budgets.
interface TraceScenario {
  readonly name: string;
  readonly run: () => void;
}

const FIXTURES = new URL("../sim/fixtures/behaviourTraces/", import.meta.url);
const UPDATE = process.env.BEHAVIOUR_TRACE_UPDATE === "1";
const DUMP = process.env.BEHAVIOUR_TRACE_DUMP;

// Drives every behaviour active from the start, retrying after each death within the budget.
function runEncounter(
  layout: ZoneLayout,
  script: EncounterScript,
  start?: (zone: ZoneState) => ZoneState,
) {
  const activate = (zone: ZoneState) =>
    zone.behaviours.reduce((state, _, index) => activateBehaviour(index, state), zone);
  let zone = activate(startZone(ORDINARY, layout, 1));
  zone = start ? start(zone) : zone;
  for (let tick = 0; tick < ENCOUNTER_TICKS && !zone.cleared; tick++) {
    zone = zone.death ? activate(retryZone(ORDINARY, layout, zone)) : zone;
    zone = stepZone(SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, script(tick), zone);
  }
}

// Encounter regression chunks: every admitted arena in its stage's theme, one per boss and
// terrain skin, and the crumbling support crossing.
const ENCOUNTER_CHUNKS: Readonly<Record<string, readonly string[]>> = {
  "arena-bear-ravine": ["ravine"],
  "arena-dog-city-boundary": ["city-boundary"],
  "arena-ferret-penthouse": ["apartment-penthouse"],
  "arena-ferret-residential-floors": ["apartment-residential"],
  "arena-goose-river-crossing": ["river-crossing"],
  "arena-pigeon-freight-terminal": ["freight-terminal"],
  "arena-raccoon-familiar-neighbourhood": ["familiar-neighbourhood"],
  "crumbling-support-crossing": ["apartment-lobby", "city-streets"],
};

export function encounterTraceScenarios(): TraceScenario[] {
  const scenarios = Object.entries(ENCOUNTER_CHUNKS).flatMap(([id, themes]) =>
    themes.flatMap((theme) =>
      Object.entries(ENCOUNTER_SCRIPTS).map(([script, input]) => ({
        name: `encounter ${id} ${theme} ${script}`,
        run: () => runEncounter(chunkLayout(theme, id), input),
      })),
    ),
  );
  const lift = Object.entries(ENCOUNTER_SCRIPTS).flatMap(([script, input]) => [
    {
      name: `encounter outdoor-lift-ascent ${script}`,
      run: () => runEncounter(liftLayout(), input),
    },
    {
      name: `encounter outdoor-lift-ascent lower-dock ${script}`,
      run: () => {
        const layout = liftLayout();
        runEncounter(layout, input, liftLowerDockStart(layout));
      },
    },
  ]);
  return [...scenarios, ...lift];
}

// Planned-navigation runs reach each stage's first encounters; the reactive run covers a stage
// whose planned run is too slow for a per-commit check.
const STAGE_RUNS = [
  ["street", 1, "planned"],
  ["city-boundary", 2, "planned"],
  ["loading-yards", 3, "planned"],
  ["freight-terminal", 4, "planned"],
  ["deep-woods", 5, "reactive"],
] as const;

export function stageTraceScenarios(): TraceScenario[] {
  return STAGE_RUNS.map(([stage, seed, jump]) => ({
    name: `stage ${stage} seed ${seed} ${jump}`,
    run: () => {
      simulateStage(BIRD, stageLoader(stage)(seed), {
        maxRetries: 2,
        maxSteps: 3600,
        policy: { ...FORWARD_POLICY, jump },
        seed,
        skill:
          jump === "planned"
            ? { ...DIAGNOSTIC_SKILL, navigation: NAVIGATION_DEFAULTS }
            : DIAGNOSTIC_SKILL,
      });
    },
  }));
}

// Every chunk's required walk, empty and filled, in the chunk walk's own partitions.
export function walkTraceScenarios(partition: number): TraceScenario[] {
  const cases = chunkWalkPartitions(ALL_CHUNKS)[partition];
  if (!cases) {
    throw new Error(`Unknown trace walk partition ${partition}`);
  }
  return cases.flatMap((entry) => {
    const [name] = entry;
    const fills = FILLED_CHUNK_SLOTS[name];
    const profiles = [
      ["empty", { door: [], event: [] }] as const,
      ...(fills ? [["filled", fills] as const] : []),
    ];
    return profiles.map(([profile, slots]) => ({
      name: `walk ${name} ${profile}`,
      run: () => {
        const plan = chunkWalkPlan(slots, entry);
        const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
        if (name.startsWith("fixture ")) {
          walkZone(BIRD, layout);
          return;
        }
        const targets = REQUIRED_CHUNK_ROUTES[name] ?? [];
        walkRequiredRoutes(
          BIRD,
          { targets: targets.map((target) => ({ ...target, area: plan.start.area })), tile: TILE },
          layout,
        );
      },
    }));
  });
}

// Compares each scenario's trace hash with its recorded baseline. BEHAVIOUR_TRACE_UPDATE=1
// rewrites the group's baseline; BEHAVIOUR_TRACE_DUMP=<dir> writes every full trace there.
export function registerTraceSuite(group: string, scenarios: readonly TraceScenario[]): void {
  const file = new URL(`${group}.json`, FIXTURES);
  const baseline: Readonly<Record<string, string>> = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, string>)
    : {};
  const observed: Record<string, string> = {};
  describe(`behaviour trace ${group}`, () => {
    afterAll(() => {
      if (UPDATE) {
        mkdirSync(FIXTURES, { recursive: true });
        const sorted = Object.fromEntries(
          Object.entries(observed).sort(([a], [b]) => (a < b ? -1 : 1)),
        );
        writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
      }
    });
    it("records a baseline for exactly its scenarios", () => {
      if (!UPDATE) {
        expect(Object.keys(baseline).sort()).toEqual(scenarios.map(({ name }) => name).sort());
      }
    });
    it.each(scenarios.map((scenario) => [scenario.name, scenario] as const))(
      "%s",
      (name, { run }) => {
        const recorder = traceRecorder({ retain: DUMP !== undefined });
        TRACE.active = recorder;
        try {
          run();
        } finally {
          TRACE.active = undefined;
        }
        observed[name] = recorder.hash();
        if (DUMP !== undefined) {
          mkdirSync(DUMP, { recursive: true });
          writeFileSync(
            `${DUMP}/${name.replace(/[^A-Za-z0-9.-]+/g, "_")}.trace`,
            `${recorder.lines()!.join("\n")}\n`,
          );
        }
        expect(recorder.ticks()).toBeGreaterThan(0);
        if (!UPDATE) {
          expect(observed[name], `${name}: rerun with BEHAVIOUR_TRACE_DUMP to diff`).toBe(
            baseline[name],
          );
        }
      },
      // The longest walk takes about 8 minutes on a hosted runner, and a busy runner is up to
      // 1.8x slower.
      1_200_000,
    );
  });
}
