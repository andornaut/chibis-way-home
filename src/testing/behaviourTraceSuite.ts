import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import { traceRecorder } from "../ai/trace";
import { BIRD } from "../data/bird";
import { OUTDOOR_LIFT_ASCENT_TRANSIT } from "../data/forcedTransit";
import { TILE } from "../data/screen";
import type { BirdTuning, ZoneLayout } from "../data/types";
import { type ChunkLibrary, themesOf, zonePlanOf } from "../rules/assemble";
import { startBird } from "../rules/bird";
import { STEP_SECONDS } from "../rules/step";
import { zoneLayout } from "../rules/tiles";
import {
  activateBehaviour,
  retryZone,
  startZone,
  stepZone,
  type ZoneInput,
  type ZoneState,
} from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { DIAGNOSTIC_SKILL, FORWARD_POLICY, NAVIGATION_DEFAULTS } from "../sim/bot";
import { stageLoader } from "../sim/catalogue";
import { simulateStage } from "../sim/simulate";
import { walkRequiredRoutes, walkZone } from "../sim/zoneWalk";
import { BIRD_FRAME } from "../view/bird";
import { TRACE } from "./behaviourTraceHook";
import { ALL_CHUNKS } from "./chunks";
import { chunkWalkPlan } from "./chunkWalkCases";
import { chunkWalkPartitions } from "./chunkWalkPartitions";
import { FILLED_CHUNK_SLOTS, REQUIRED_CHUNK_ROUTES } from "./requiredRoutes";
import { CATALOGUE, HITBOXES, TILESETS } from "./walkSuite";

// Each scenario must be deterministic: fixed seeds, fixed inputs and no wall-clock budgets.
export interface TraceScenario {
  readonly name: string;
  readonly run: () => void;
}

const FIXTURES = new URL("../sim/fixtures/behaviourTraces/", import.meta.url);
const UPDATE = process.env.BEHAVIOUR_TRACE_UPDATE === "1";
const DUMP = process.env.BEHAVIOUR_TRACE_DUMP;

const ordinary: BirdTuning = { ...BIRD, doubleJump: false };
delete (ordinary as { dash?: unknown }).dash;
const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };

type Script = (tick: number, zone: ZoneState) => ZoneInput;
const SCRIPTS: Readonly<Record<string, Script>> = {
  // Runs right with a periodic held jump, so pursuers chase, attack and cross.
  forward: (tick) => ({ jumpHeld: tick % 90 < 24, move: 1, useHeld: false }),
  // Paces out and back with a periodic held jump, exposing Chibi on both sides of the entry.
  pace: (tick) => ({
    jumpHeld: tick % 120 < 24,
    move: Math.floor(tick / 240) % 2 === 0 ? 1 : -1,
    useHeld: false,
  }),
  // Stands at the entry, so pursuers approach, attack and recover.
  still: () => STILL,
};
const ENCOUNTER_TICKS = 1500;

function chunkLayout(theme: string, id: string, library: ChunkLibrary = CHUNK_LIBRARY) {
  const plan = zonePlanOf(library, () => 0, { door: [], event: [] }, theme, 2, [id]);
  return zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
}

// The certified lift contract on its own base chunk, as its forced-transit test builds it.
function liftLayout(): ZoneLayout {
  const chunk = CHUNK_LIBRARY.chunks["outdoor-lift-ascent"]!;
  const library: ChunkLibrary = {
    ...CHUNK_LIBRARY,
    chunks: {
      ...CHUNK_LIBRARY.chunks,
      "outdoor-lift-ascent": {
        ...chunk,
        objects: chunk.objects.map((instance) =>
          instance.character === "city-lift"
            ? { ...instance, forcedTransit: OUTDOOR_LIFT_ASCENT_TRANSIT }
            : instance,
        ),
      },
    },
  };
  return chunkLayout(themesOf(chunk)[0]!, "outdoor-lift-ascent", library);
}

// Drives every behaviour active from the start, retrying after each death within the budget.
function runEncounter(layout: ZoneLayout, script: Script, start?: (zone: ZoneState) => ZoneState) {
  const activate = (zone: ZoneState) =>
    zone.behaviours.reduce((state, _, index) => activateBehaviour(index, state), zone);
  let zone = activate(startZone(ordinary, layout, 1));
  zone = start ? start(zone) : zone;
  for (let tick = 0; tick < ENCOUNTER_TICKS && !zone.cleared; tick++) {
    zone = zone.death ? activate(retryZone(ordinary, layout, zone)) : zone;
    zone = stepZone(ordinary, layout, STEP_SECONDS, script(tick, zone), zone);
  }
}

// Boss regression chunks with one theme per distinct pursuer and terrain skin: the climb-yard
// variants (goose wall and Fert underpass), Pebble's yards, and the crumbling support crossing.
const ENCOUNTER_CHUNKS: Readonly<Record<string, readonly string[]>> = {
  "apartment-tall-city-boundary-climb-yard": ["apartment-lobby"],
  "blue-vertical-city-boundary-climb-yard": [
    "apartment-entrance",
    "apartment-lobby",
    "city-streets",
    "farmland",
  ],
  "bounded-flyer-post": ["loading-yards"],
  "city-boundary-climb-yard": ["apartment-entrance", "apartment-lobby", "city-streets", "farmland"],
  "countryside-vertical-city-boundary-climb-yard": ["farmland"],
  "crumbling-support-crossing": ["apartment-lobby", "city-streets"],
  "dry-underground-gallery-encounter": ["loading-yards"],
  "flyer-shelter-early": ["loading-yards"],
  "flyer-shelter-middle": ["loading-yards"],
};

export function encounterTraceScenarios(): TraceScenario[] {
  const scenarios = Object.entries(ENCOUNTER_CHUNKS).flatMap(([id, themes]) => {
    const chunk = CHUNK_LIBRARY.chunks[id];
    if (!chunk || themes.some((theme) => !themesOf(chunk).includes(theme))) {
      throw new Error(`Unknown trace chunk or theme ${id}`);
    }
    return themes.flatMap((theme) =>
      Object.entries(SCRIPTS).map(([script, input]) => ({
        name: `encounter ${id} ${theme} ${script}`,
        run: () => runEncounter(chunkLayout(theme, id), input),
      })),
    );
  });
  const lift = Object.entries(SCRIPTS).flatMap(([script, input]) => [
    {
      name: `encounter outdoor-lift-ascent ${script}`,
      run: () => runEncounter(liftLayout(), input),
    },
    {
      name: `encounter outdoor-lift-ascent lower-dock ${script}`,
      run: () => {
        const layout = liftLayout();
        const lift = layout.areas.main!.objects.find(({ forcedTransit }) => forcedTransit)!;
        const lower = lift.forcedTransit!.banks.find(({ id }) => id === "lower")!;
        runEncounter(layout, input, (zone) => ({
          ...zone,
          bird: startBird(ordinary, { x: lower.x + 24, y: lower.y }),
        }));
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
      600_000,
    );
  });
}
