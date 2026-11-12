import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets/index.ts";
import { ARCHETYPES } from "../data/archetypes.ts";
import { BIRD } from "../data/bird.ts";
import type { Character, ChunkPlan, Instance, ZoneRecipe } from "../data/types/index.ts";
import { assembleZone, type ChunkLibrary } from "./assemble.ts";
import { chunkProblems } from "./chunk.ts";
import { zoneLayout } from "./tiles.ts";
import { enterArea } from "./zone.ts";

const characters: Readonly<Record<string, Character>> = {
  door: { archetype: "door", art: "door", cols: 2, rows: 3 },
  hazard: { archetype: "hazard-wanderer", art: "hazard", cols: 2, rows: 2 },
  scenery: { archetype: "scenery", art: "scenery", cols: 2, rows: 2 },
};
const catalogue = { archetypes: ARCHETYPES, characters };
const placement: Instance = {
  character: "",
  col: 12,
  role: "distant",
  row: 48,
};
const chunk: ChunkPlan = {
  backdrops: [{ character: "scenery", col: 0, cols: 60, row: 0 }],
  cols: 60,
  difficulty: 1,
  encounters: 0,
  entry: { row: 50 },
  exit: { row: 50 },
  objects: [{ character: "hazard", col: 24, row: 48 }],
  slots: [{ area: { col: 40, cols: 4, row: 46, rows: 4 }, id: "door", kind: "door" }],
  solids: [{ col: 0, cols: 60, look: "ground", row: 50, rows: 10 }],
  theme: "test",
};
function library(scenery?: readonly Instance[]): ChunkLibrary {
  return {
    characters,
    chunks: { finish: chunk, middle: { ...chunk, ...(scenery && { scenery }) }, start: chunk },
    rows: 60,
    rules: { cols: { max: 60, min: 60 }, footing: 4, headroom: 6 },
    seams: [50],
    themes: {
      test: {
        backdrops: [{ character: "scenery", row: 0 }],
        bindings: {
          distant: { character: "scenery", parallax: { x: 0.4, y: 1 } },
          door: { character: "door" },
        },
        door: "door",
        looks: { ground: "grass" },
        tileset: "grass",
      },
    },
  };
}
const recipe: ZoneRecipe = {
  difficulty: { max: 1, min: 1 },
  doors: [{ count: 1, room: "room" }],
  events: [],
  finish: "finish",
  length: { max: 180, min: 180 },
  spawnCol: 2,
  start: "start",
  theme: "test",
};

describe("append-only chunk scenery", () => {
  it("preserves every existing index, filled door, initial position and seeded motion", () => {
    const plans = [library(), library([placement])].map((source) =>
      assembleZone(source, 27, "stage", recipe),
    );
    const before = plans[0]!;
    const after = plans[1]!;
    const prefix = before.areas.main!.objects;
    expect(prefix.some((object) => object.room === "room")).toBe(true);
    expect(after.areas.main!.objects.slice(0, prefix.length)).toEqual(prefix);
    expect(after.areas.main!.objects.slice(prefix.length)).toEqual([
      { character: "scenery", col: 72, parallax: { x: 0.4, y: 1 }, role: "distant", row: 48 },
    ]);
    const states = plans.map((plan) => {
      const layout = zoneLayout(12, BIRD_FRAME, catalogue, {}, {}, new Set(), plan);
      return enterArea(BIRD, layout, plan.start, {
        attempt: 3,
        restarts: 2,
        seed: 27,
        steps: 0,
      });
    });
    expect(states[1]!.objects.slice(0, prefix.length)).toEqual(states[0]!.objects);
    for (const seconds of [0, 0.5, 4]) {
      expect(states[1]!.tracks.slice(0, prefix.length).map((track) => track.at(seconds))).toEqual(
        states[0]!.tracks.map((track) => track.at(seconds)),
      );
    }
    expect(
      states[0]!.tracks.some(
        (track) => JSON.stringify(track.at(0)) !== JSON.stringify(track.at(4)),
      ),
    ).toBe(true);
  });

  it.each([
    { instance: placement, name: "bound parallax" },
    { instance: { character: "scenery", col: 12, row: 48 }, name: "unbound world decoration" },
  ])("accepts $name from the chunk scenery collection", ({ instance }) => {
    const source = library([instance]);
    expect(chunkProblems(source, catalogue, source.chunks.middle!)).toEqual([]);
  });

  it.each([
    { instance: { ...placement, col: 60 }, name: "out-of-bounds placement" },
    { instance: { ...placement, role: "missing" }, name: "missing role binding" },
    {
      instance: {
        ...placement,
        orbit: { angularSpeed: 1, host: "host", kind: "circle" as const, phase: 0, radius: 2 },
      },
      name: "orbit relationship",
    },
    {
      instance: { character: "hazard", col: 12, parallax: { x: 0.4, y: 1 }, row: 48 },
      name: "physical hazard",
    },
  ])("rejects scenery with $name", ({ instance }) => {
    const source = library([placement]);
    expect(chunkProblems(source, catalogue, { ...chunk, scenery: [instance] })).not.toEqual([]);
  });
});
