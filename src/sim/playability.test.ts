import { describe, expect, it } from "vitest";

import { ARCHETYPES } from "../data/archetypes";
import type { BehaviourPlan, ChunkPlan, ZonePlan } from "../data/types";
import {
  assessPlayability,
  comparePlayability,
  formatPlayabilityMarkdown,
  type PlayabilityContext,
} from "./playability";
const graph: BehaviourPlan = {
  axis: "x",
  distance: -8,
  initial: "charge",
  states: {
    charge: {
      animation: "rush",
      motion: { direction: "facing", kind: "move", speed: 3 },
      onEnter: [
        {
          armSeconds: 0,
          character: "enemy",
          gravity: 3,
          kind: "spawn",
          lifeSeconds: 1,
          maxAlive: 1,
          offset: { x: 0, y: 0 },
          velocity: { x: 0, y: 2 },
        },
        { height: 2, kind: "force-pulse", range: 4, seconds: 0.2, velocity: { x: 3, y: 0 } },
      ],
      track: { axis: "y", distance: -4 },
      transitions: [{ to: "charge", when: [{ kind: "boundary" }] }],
    },
    unused: {
      animation: null,
      motion: { direction: 1, hopHeight: 1, hopSeconds: 1, kind: "hop", speed: 1 },
      transitions: [],
    },
  },
};
const chunk: ChunkPlan = {
  cols: 20,
  difficulty: 3,
  encounters: 1,
  entry: { row: 50 },
  exit: { row: 40 },
  objects: [],
  solids: [],
  theme: "test",
};
const plan: ZonePlan = {
  areaOrder: ["second", "first"],
  areas: Object.fromEntries(
    ["first", "second"].map((id) => [
      id,
      {
        chunks: [
          { chunk: "encounter", col: 0, cols: 20 },
          { chunk: "quiet", col: 20, cols: 20 },
        ],
        cols: 40,
        entries: { start: { col: 2, row: 50 } },
        objects: [{ character: "enemy", col: 5, row: 46 }],
        rows: 60,
        solids: [
          { col: 0, cols: 10, row: 50, rows: 10 },
          { col: 15, cols: 25, row: 40, rows: 20 },
        ],
      },
    ]),
  ),
  start: { area: "second", entry: "start" },
};
function context(): PlayabilityContext {
  return {
    archetypes: ARCHETYPES,
    catalogue: [{ id: "zone", stages: ["stage"] }],
    library: {
      characters: {
        enemy: { archetype: "hazard", art: "enemy", behaviour: graph, cols: 4, rows: 4 },
      },
      chunks: { encounter: chunk, quiet: { ...chunk, encounters: 0, entry: { row: 40 } } },
      rows: 60,
      rules: { cols: { max: 60, min: 1 }, footing: 4, headroom: 6 },
      seams: [30, 40, 50],
      themes: {},
    },
    load: () => plan,
    provenance: { data: "fixture-data", source: "fixture-source" },
    recipes: {},
  };
}
describe("structural playability assessment", () => {
  it("counts reachable graph capabilities and preserves actual area/chunk order without simulating", () => {
    const report = assessPlayability(context(), [7]);
    const stage = report.stages[0]!;
    expect(stage.areas.map(({ id }) => id)).toEqual(["second", "first"]);
    expect(stage.mechanics).toEqual({
      "committed-charge": 2,
      "force-gust": 2,
      "lethal-contact": 2,
      "mover:y": 2,
      "projectile-spawn": 2,
      "seam-rise": 2,
    });
    expect(stage.encounters).toBe(2);
    expect(stage.mechanicsPer100Cols["force-gust"]).toBe(2.5);
    expect(stage.longestEncounterFreeChunkRunPerAreaCols).toBe(20);
    expect(stage.geometry[0]!.terrainProjectionGaps).toEqual([{ col: 10, cols: 5 }]);
    expect(formatPlayabilityMarkdown(report)).toContain("not a playthrough");
    expect(assessPlayability(context(), [7])).toEqual(report);
  });
  it.each(["ground", "fly"] as const)(
    "classifies live %s pursuit independently of locked flight",
    (mode) => {
      const input = context();
      const pursuit: BehaviourPlan = {
        ...graph,
        pursuit: {
          distance: 100,
          escaped: { line: "escaped", speaker: "actor" },
          unreachableGraceSeconds: 1,
        },
        states: {
          charge: { animation: null, motion: { kind: "pursue", mode, speed: 5 }, transitions: [] },
        },
      };
      const report = assessPlayability(
        {
          ...input,
          library: {
            ...input.library,
            characters: { enemy: { ...input.library.characters.enemy!, behaviour: pursuit } },
          },
        },
        [7],
      );
      expect(report.stages[0]!.mechanics["target-pursuit"]).toBe(2);
      expect(report.stages[0]!.mechanics[`pursuit:${mode}`]).toBe(2);
      expect(report.stages[0]!.mechanics).not.toHaveProperty("target-locked-flight");
    },
  );
  it("records orbital hazards independently of their inert local motion", () => {
    const input = context();
    const makeReport = (angularSpeed: number) =>
      assessPlayability(
        {
          ...input,
          library: {
            ...input.library,
            characters: {
              enemy: { archetype: "hazard", art: "enemy", cols: 1, rows: 1 },
              host: { archetype: "platform", art: "host", cols: 6, rows: 1 },
            },
          },
          load: () => ({
            ...plan,
            areas: Object.fromEntries(
              Object.entries(plan.areas).map(([id, area]) => [
                id,
                {
                  ...area,
                  objects: [
                    {
                      character: "host",
                      col: 5,
                      id: "host",
                      overrides: { motion: { distance: 2, speed: 1 } },
                      row: 40,
                    },
                    {
                      character: "enemy",
                      col: 9.5,
                      orbit: { angularSpeed, host: "host", phase: 0, radius: 2 },
                      row: 40,
                    },
                  ],
                },
              ]),
            ),
          }),
        },
        [7],
      );
    const report = makeReport(Math.PI);
    const faster = makeReport(2 * Math.PI);
    expect(faster.stages[0]!.geometryFingerprint).toBe(report.stages[0]!.geometryFingerprint);
    expect(faster.stages[0]!.demandFingerprint).not.toBe(report.stages[0]!.demandFingerprint);
    expect(report.stages[0]!.mechanics["orbital-hazard"]).toBe(Object.keys(plan.areas).length);
  });
  it("compares different provenance while rejecting different seeds and catalogue order", () => {
    const before = assessPlayability(context(), [7]);
    const after = assessPlayability(
      { ...context(), provenance: { data: "new", source: "new" } },
      [7],
    );
    expect(comparePlayability(before, after).stages[0]!.lengthColsDelta).toBe(0);
    const input = context();
    const fasterGraph: BehaviourPlan = {
      ...graph,
      states: {
        ...graph.states,
        charge: {
          ...graph.states.charge!,
          motion: { direction: "facing", kind: "move", speed: 6 },
        },
      },
    };
    const changed = assessPlayability(
      {
        ...input,
        library: {
          ...input.library,
          characters: { enemy: { ...input.library.characters.enemy!, behaviour: fasterGraph } },
        },
        load: () => ({
          ...plan,
          areas: {
            ...plan.areas,
            first: {
              ...plan.areas.first!,
              solids: [
                { col: 0, cols: 8, row: 50, rows: 10 },
                { col: 15, cols: 25, row: 40, rows: 20 },
              ],
            },
          },
        }),
      },
      [7],
    );
    const delta = comparePlayability(before, changed).stages[0]!;
    expect(delta.geometryChanged).toBe(true);
    expect(delta.demandChanged).toBe(true);
    expect(delta.sequenceChanged).toBe(false);
    expect(changed.stages[0]!.mechanics).toEqual(before.stages[0]!.mechanics);

    const paired = (swapped: boolean): PlayabilityContext => ({
      ...input,
      library: {
        ...input.library,
        characters: {
          ...input.library.characters,
          fast: { ...input.library.characters.enemy!, behaviour: fasterGraph },
        },
      },
      load: () => ({
        ...plan,
        areas: {
          ...plan.areas,
          first: {
            ...plan.areas.first!,
            objects: [
              { character: swapped ? "fast" : "enemy", col: 5, row: 46 },
              { character: swapped ? "enemy" : "fast", col: 25, row: 46 },
            ],
          },
        },
      }),
    });
    const exchange = comparePlayability(
      assessPlayability(paired(false), [7]),
      assessPlayability(paired(true), [7]),
    ).stages[0]!;
    expect(exchange.geometryChanged).toBe(false);
    expect(exchange.demandChanged).toBe(true);

    expect(() => comparePlayability(before, assessPlayability(context(), [8]))).toThrow(
      "Incompatible",
    );
    expect(() =>
      comparePlayability(before, { ...after, stages: [{ ...after.stages[0]!, id: "other" }] }),
    ).toThrow("Incompatible");
    expect(() =>
      comparePlayability(before, { ...after, stages: [{ ...after.stages[0]!, zone: "other" }] }),
    ).toThrow("Incompatible");
  });
  it("rejects missing provenance, duplicate seeds and unresolved selected chunks", () => {
    expect(() =>
      assessPlayability({ ...context(), provenance: { data: "x", source: "" } }, [1]),
    ).toThrow("provenance");
    expect(() => assessPlayability(context(), [1, 1])).toThrow("distinct");
    const input = context();
    expect(() =>
      assessPlayability({ ...input, library: { ...input.library, chunks: {} } }, [1]),
    ).toThrow("Unknown selected chunk");
  });
});
