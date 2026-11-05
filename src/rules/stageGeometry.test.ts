import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { ARCHETYPES } from "../data/archetypes";
import { BIRD } from "../data/bird";
import type { ChunkPlan, OrderedZoneRecipe, ZoneRecipe } from "../data/types";
import { SKILL_PROFILES } from "../progress";
import { assembleZone, type ChunkLibrary } from "./assemble";
import { chunkProblems, recipeProblems } from "./chunk";
import { zoneLayout } from "./tiles";
import { startZone, stepZone } from "./zone";

const cap: ChunkPlan = {
  cols: 60,
  difficulty: 1,
  encounters: 0,
  entry: { row: 50 },
  exit: { row: 50 },
  objects: [],
  rows: 80,
  solids: [
    { col: 0, cols: 4, look: "ground", row: 50, rows: 30 },
    { col: 56, cols: 4, look: "ground", row: 50, rows: 30 },
    { col: 4, cols: 52, look: "ground", row: 70, rows: 10 },
  ],
  theme: "test",
};
const library: ChunkLibrary = {
  characters: { door: { cols: 2, rows: 3 } },
  chunks: { finish: cap, middle: cap, start: cap },
  rows: 60,
  rules: { cols: { max: 60, min: 60 }, footing: 4, headroom: 6 },
  seams: [30, 40, 50],
  themes: {
    test: {
      backdrops: [],
      bindings: { door: { character: "door" } },
      door: "door",
      looks: { ground: "ground" },
      tileset: "ground",
    },
  },
};
const recipe: ZoneRecipe = {
  chunks: ["middle"],
  difficulty: { max: 1, min: 1 },
  doors: [],
  events: [],
  finish: "finish",
  length: { max: 180, min: 180 },
  rows: 80,
  spawnCol: 10,
  spawnRow: 70,
  stageExit: { col: 10, cols: 2, row: 19, rows: 3 },
  start: "start",
  theme: "test",
};
const resolve = (plan: ReturnType<typeof assembleZone>) =>
  zoneLayout(
    12,
    BIRD_FRAME,
    {
      archetypes: ARCHETYPES,
      characters: { door: { archetype: "door", art: "door", cols: 2, rows: 3 } },
    },
    {},
    {},
    new Set(),
    plan,
  );
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;

describe("authored floor height and exit geometry", () => {
  it("keeps bottom spawn and upper final-cap trigger explicit without changing horizontal seams", () => {
    const plan = assembleZone(library, 1, "fixture", recipe);
    const area = plan.areas.main!;
    expect(area.rows).toBe(80);
    expect(area.entries.start).toEqual({ col: 10, row: 70 });
    expect(area.solids).toContainEqual({ col: 124, cols: 52, look: "ground", row: 70, rows: 10 });
    expect(plan.stageExit).toEqual({ area: "main", rect: { col: 130, cols: 2, row: 19, rows: 3 } });
    expect(recipeProblems(library, recipe)).toEqual([]);
    expect(chunkProblems(library, { archetypes: ARCHETYPES, characters: {} }, cap)).toEqual([]);
    const layout = resolve(plan);
    expect(layout.areas.main!.height).toBe(960);
    expect(layout.stageExit).toEqual({
      area: "main",
      rect: { height: 36, width: 24, x: 1560, y: 228 },
    });
    const initial = startZone(BIRD, layout, 1);
    expect(initial.bird.y + BIRD.height).toBe(840);
    const cleared = stepZone(SKILL_PROFILES, BIRD, layout, 0, idle, {
      ...initial,
      bird: { ...initial.bird, x: 1560, y: 228 },
    });
    expect(cleared.cleared).toBe(true);
    expect(cleared.area).toBe(initial.area);
    expect(cleared.attempt).toBe(initial.attempt);
    const atEdge = { ...initial, bird: { ...initial.bird, x: 2150, y: 228 } };
    expect(stepZone(SKILL_PROFILES, BIRD, layout, 0, idle, atEdge).cleared).toBe(false);
    const ordinary = { ...layout };
    delete ordinary.stageExit;
    expect(stepZone(SKILL_PROFILES, BIRD, ordinary, 0, idle, atEdge).cleared).toBe(true);
  });
  it("lets the automatic exit win over a room Use on the same frame", () => {
    const plan = assembleZone(library, 1, "fixture", recipe);
    const layout = resolve({
      ...plan,
      areas: {
        main: {
          ...plan.areas.main!,
          objects: [{ character: "door", col: 130, room: "room", row: 19 }],
        },
      },
    });
    const initial = startZone(BIRD, layout, 1);
    const result = stepZone(
      SKILL_PROFILES,
      BIRD,
      layout,
      0,
      { ...idle, useHeld: true },
      { ...initial, bird: { ...initial.bird, x: 1560, y: 228 }, useHeld: false },
    );
    expect(result.cleared).toBe(true);
    expect(result.door).toBeUndefined();
  });
  it("keeps section-specific spawn rows and translates the trigger inside the final ordered area", () => {
    const source = { ...library, chunks: { ...library.chunks, upper: cap } };
    const section = {
      chunks: ["middle"],
      difficulty: recipe.difficulty,
      doors: [],
      events: [],
      length: { max: 120, min: 120 },
      rows: 80,
      spawnCol: 10,
      spawnRow: 70,
      theme: "test",
    };
    const ordered: OrderedZoneRecipe = {
      finish: "finish",
      sections: [
        { ...section, id: "lower" },
        { ...section, chunks: ["upper"], id: "upper" },
      ],
      stageExit: recipe.stageExit!,
      start: "start",
      transitionRoles: { left: "door", right: "door" },
    };
    const plan = assembleZone(source, 1, "fixture", ordered);
    expect(plan.areas.lower!.rows).toBe(80);
    expect(plan.areas.upper!.entries.start!.row).toBe(70);
    expect(plan.stageExit).toEqual({ area: "upper", rect: { col: 70, cols: 2, row: 19, rows: 3 } });
  });
  it("refuses mismatched cap and middle heights instead of stretching their geometry", () => {
    expect(() => assembleZone(library, 1, "fixture", { ...recipe, rows: 60 })).toThrow("height");
    const short = { ...cap };
    delete short.rows;
    const mixed = { ...library, chunks: { ...library.chunks, middle: short } };
    expect(() => assembleZone(mixed, 1, "fixture", recipe)).toThrow("height");
  });
  it.each([0, 1.5, NaN])("rejects invalid authored height %s", (rows) => {
    expect(
      chunkProblems(library, { archetypes: ARCHETYPES, characters: {} }, { ...cap, rows }),
    ).not.toEqual([]);
    expect(() => assembleZone(library, 1, "fixture", { ...recipe, rows })).toThrow("height");
  });
  it("rejects a spawn without authored footing, an outside trigger and a seam beyond the height", () => {
    expect(() => assembleZone(library, 1, "fixture", { ...recipe, spawnRow: 60 })).toThrow(
      "terrain",
    );
    expect(() =>
      assembleZone(library, 1, "fixture", {
        ...recipe,
        stageExit: { col: 59, cols: 2, row: 10, rows: 2 },
      }),
    ).toThrow("final cap");
    const plan = assembleZone(library, 1, "fixture", recipe);
    expect(() =>
      resolve({ ...plan, stageExit: { area: "missing", rect: recipe.stageExit! } }),
    ).toThrow("real area");
    expect(
      chunkProblems(library, { archetypes: ARCHETYPES, characters: {} }, { ...cap, rows: 20 }),
    ).toContain("entry row 50 is not a seam row");
  });
});
