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
    expect(stage.longestEncounterFreeChunkRunCols).toBe(20);
    expect(stage.geometry[0]!.terrainProjectionGaps).toEqual([{ col: 10, cols: 5 }]);
    expect(formatPlayabilityMarkdown(report)).toContain("not a playthrough");
    expect(assessPlayability(context(), [7])).toEqual(report);
  });
  it("compares different provenance while rejecting different seeds and catalogue order", () => {
    const before = assessPlayability(context(), [7]);
    const after = assessPlayability(
      { ...context(), provenance: { data: "new", source: "new" } },
      [7],
    );
    expect(comparePlayability(before, after).stages[0]!.lengthColsDelta).toBe(0);
    expect(() => comparePlayability(before, assessPlayability(context(), [8]))).toThrow(
      "Incompatible",
    );
    expect(() =>
      comparePlayability(before, { ...after, stages: [{ ...after.stages[0]!, id: "other" }] }),
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
