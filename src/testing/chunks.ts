// Small chunks, a theme and a recipe for the chunk tests, which run on these as well as on
// gameplay's chunks and recipes.
import { CHARACTERS } from "../data/characters";
import { CHUNK_RULES, CHUNKS, SEAM_ROWS, THEMES } from "../data/chunks";
import { ZONE_ROWS } from "../data/screen";
import type { ChunkPlan, StageRecipe, TerrainRect, ThemePlan, ZoneRecipe } from "../data/types";
import { RECIPES } from "../data/zones";
import type { ChunkLibrary } from "../rules/assemble";
import { CHUNK_LIBRARY } from "../rules/zonePlans";

// Ground from col, cols wide, its top at row, down to the bottom row.
const ground = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ZONE_ROWS - row,
});

const hazard = (col: number, row: number, rows: number) => ({
  character: "test-hazard",
  col,
  cols: 2,
  row,
  rows,
});

// Each 60 wide, on the seam rows 50, 40 and 30, at each difficulty.
const FIXTURE_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "test-down-50": {
    cols: 60,
    difficulty: 3,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 50 },
    objects: [],
    solids: [ground(0, 30, 40), ground(30, 30, 50)],
    theme: "test",
  },
  "test-drop-50": {
    cols: 60,
    difficulty: 4,
    encounters: 0,
    entry: { row: 30 },
    exit: { row: 50 },
    objects: [],
    solids: [ground(0, 30, 30), ground(30, 30, 50)],
    theme: "test",
  },
  "test-finish": {
    cols: 60,
    difficulty: 1,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    solids: [ground(0, 60, 50)],
    theme: "test",
  },
  "test-flat-40": {
    cols: 60,
    difficulty: 3,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 40 },
    maxPerZone: 1,
    objects: [hazard(28, 37, 3)],
    slots: [{ area: { col: 10, cols: 10, row: 30, rows: 10 }, id: "left", kind: "event" }],
    solids: [ground(0, 60, 40)],
    theme: "test",
    weight: 2,
  },
  "test-flat-50": {
    cols: 60,
    difficulty: 1,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    slots: [{ area: { col: 20, cols: 10, row: 40, rows: 10 }, id: "middle", kind: "event" }],
    solids: [ground(0, 60, 50)],
    theme: "test",
  },
  "test-gap-30": {
    cols: 60,
    difficulty: 5,
    encounters: 0,
    entry: { row: 30 },
    exit: { row: 30 },
    objects: [],
    solids: [ground(0, 22, 30), ground(38, 22, 30)],
    theme: "test",
  },
  "test-gap-50": {
    cols: 60,
    difficulty: 2,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    slots: [{ area: { col: 45, cols: 3, row: 46, rows: 4 }, id: "door", kind: "door" }],
    solids: [ground(0, 25, 50), ground(35, 25, 50)],
    theme: ["test", "test-other"],
  },
  "test-hazard-50": {
    cols: 60,
    difficulty: 4,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [hazard(20, 46, 4), hazard(38, 46, 4)],
    solids: [ground(0, 60, 50)],
    theme: "test",
  },
  "test-start": {
    cols: 60,
    difficulty: 1,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    solids: [ground(0, 60, 50)],
    theme: "test",
  },
  "test-up-30": {
    cols: 60,
    difficulty: 4,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 30 },
    objects: [],
    solids: [ground(0, 24, 40), ground(24, 6, 35), ground(30, 30, 30)],
    theme: "test",
  },
  "test-up-40": {
    cols: 60,
    difficulty: 2,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 40 },
    objects: [],
    solids: [ground(0, 24, 50), ground(24, 6, 45), ground(30, 30, 40)],
    theme: "test",
  },
  "test-wide-50": {
    cols: 60,
    difficulty: 5,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    solids: [ground(0, 21, 50), ground(39, 21, 50)],
    theme: "test",
  },
};

export const FIXTURE_LIBRARY: ChunkLibrary = {
  characters: CHARACTERS,
  chunks: FIXTURE_CHUNKS,
  rows: ZONE_ROWS,
  rules: CHUNK_RULES,
  seams: SEAM_ROWS,
  themes: {
    test: {
      backdrops: [{ character: "street-sky", row: 0 }],
      bindings: { door: { character: "test-door" } },
      door: "door",
      looks: { ground: "sidewalk" },
      tileset: "tiles-street",
    },
    "test-other": {
      backdrops: [],
      bindings: { door: { character: "test-door" } },
      door: "door",
      looks: { ground: "floor" },
      tileset: "tiles-lobby",
    },
  },
};

export const FIXTURE_RECIPE: ZoneRecipe = {
  difficulty: { max: 5, min: 1 },
  doors: [{ count: 1, room: "test" }],
  events: [{ count: 1, id: "test-event" }],
  finish: "test-finish",
  length: { max: 480, min: 300 },
  spawnCol: 2,
  start: "test-start",
  theme: "test",
};

// Every chunk, by name, with its library: the fixtures' and gameplay's.
export const ALL_CHUNKS: readonly (readonly [string, ChunkLibrary, ChunkPlan])[] = [
  ...Object.entries(FIXTURE_CHUNKS).map(
    ([id, chunk]) => [`fixture ${id}`, FIXTURE_LIBRARY, chunk] as const,
  ),
  ...Object.entries(CHUNKS).map(([id, chunk]) => [id, CHUNK_LIBRARY, chunk] as const),
];

// Every theme, by name: the fixtures' and gameplay's.
export const ALL_THEMES: readonly (readonly [string, ThemePlan])[] = [
  ...Object.entries(FIXTURE_LIBRARY.themes).map(
    ([key, theme]) => [`fixture ${key}`, theme] as const,
  ),
  ...Object.entries(THEMES),
];

// Every recipe, by zone key, with its library.
export const ALL_RECIPES: readonly (readonly [string, ChunkLibrary, StageRecipe])[] = [
  ["fixture", FIXTURE_LIBRARY, FIXTURE_RECIPE],
  ...Object.entries(RECIPES).map(([key, recipe]) => [key, CHUNK_LIBRARY, recipe] as const),
];
