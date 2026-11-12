import { expect, it } from "vitest";

import { traceRecorder } from "../ai/trace.ts";
import { BIRD_FRAME } from "../assets/index.ts";
import { STEP_SECONDS } from "../core/index.ts";
import type { AreaLayout, ZoneLayout } from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { createBehaviourObserver } from "../rules/behaviourObserver.ts";
import { groundMask, mapTerrain } from "../rules/movementMaps.ts";
import { startZone, stepZone } from "../rules/zone.ts";
import { ALLOW, chibiMap } from "../sim/pathOut.ts";
import { zoneTraceLine } from "../sim/zoneTrace.ts";
import { gameArenaCase } from "./arenas.ts";
import { ARENA_SAMPLES } from "./arenaSamples.ts";
import { createBehaviourObservations } from "./behaviourObservations.ts";
import { chunksLayout, ORDINARY } from "./encounterLayouts.ts";
import { type EvadeContext, evadeRun, stepEvade } from "./evade.ts";
import { observedEvadeRun } from "./observedEvade.ts";

const input = { jumpHeld: false, move: 0 as const, useHeld: false };

it("keeps the actual advance state and trace identical for absent, observed and failed receivers", () => {
  const layout = chunksLayout("city-boundary", ["arena-dog-city-boundary"]);
  const initial = startZone(ORDINARY, layout, 0);
  const observations = createBehaviourObservations();
  const failing = createBehaviourObserver(() => {
    throw new Error("Receiver unavailable");
  });
  const plain = stepZone(SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, input, initial);
  const absent = stepEvade(undefined, layout, input, initial);
  const observed = stepEvade(observations.observer, layout, input, initial);
  const failed = stepEvade(failing, layout, input, initial);
  const hash = (next: typeof initial) => {
    const trace = traceRecorder({ retain: false });
    trace.record(zoneTraceLine(layout, STEP_SECONDS, initial, next));
    return trace.hash();
  };
  expect(absent).toEqual(plain);
  expect(observed).toEqual(plain);
  expect(failed).toEqual(plain);
  expect([hash(absent), hash(observed), hash(failed)]).toEqual(Array(3).fill(hash(plain)));
  expect(observations.report().work.simulation_ticks).toEqual({ status: "captured", value: 1 });
  expect(failing.failures().length).toBeGreaterThan(0);
  expect(failing.failures().every(({ message }) => message === "Receiver unavailable")).toBe(true);
});

// Each synthetic episode advances once through the engine, without arena qualification.
function oneStepContext(): EvadeContext {
  const floor = { height: 120, width: 144, x: 0, y: 600 };
  const area: AreaLayout = {
    backX: 0,
    chunks: [],
    entries: { start: { x: 24, y: floor.y } },
    exitX: 24,
    height: 720,
    objects: [],
    solids: [floor],
    terrain: [],
    tileset: undefined,
    width: 144,
  };
  const layout: ZoneLayout = {
    areas: { main: area },
    birdFrame: BIRD_FRAME,
    start: { area: "main", entry: "start" },
  };
  const terrain = mapTerrain({}, area);
  const chibi = chibiMap(ORDINARY, terrain);
  const found = gameArenaCase(ARENA_SAMPLES[0]!);
  return {
    found: {
      ...found,
      arena: {
        ...found.arena,
        entry: { row: 50 },
        exit: { row: 50 },
        refuges: [],
        routes: [
          {
            id: "loop",
            waypoints: [
              { col: 2, row: 50 },
              { col: 8, row: 50 },
              { col: 2, row: 50 },
            ],
          },
        ],
      },
    },
    layout,
    maps: {
      chibi,
      encounter: { area, bosses: [], terrain },
      mask: groundMask({ allowed: ALLOW, climb: false, key: "fixture" }, chibi),
    },
  };
}

it("returns separate FREE and BOSS reports beside an unchanged short synthetic run", () => {
  const context = oneStepContext();
  const plain = evadeRun(context, "entry", 0);
  const observed = observedEvadeRun(context, "entry", 0);
  expect(observed.run).toEqual(plain);
  expect(observed.run.work).toBe(2);
  expect(observed.episodes.boss).not.toBe(observed.episodes.free);
  for (const episode of [observed.episodes.free, observed.episodes.boss]) {
    expect(episode.work.simulation_ticks).toEqual({ status: "captured", value: 1 });
    expect(episode.diagnostics.deliveryFailures).toEqual([]);
    expect(episode.diagnostics.recordedEvents).toBe(1);
  }
  expect(observed.run).not.toHaveProperty("episodes");
});
