import { FOUR_SCREEN_ROWS } from "../chunks.ts";
import { CHUNK_COLS } from "../chunkTemplates.ts";
import type { ChunkModule, Difficulty, ModuleRules } from "../types/index.ts";
import { APARTMENT_MODULES } from "./apartment.ts";
import { BLUE_MODULES } from "./blue.ts";
import { COUNTRYSIDE_MODULES } from "./countryside.ts";
import { HOME_MODULES } from "./home.ts";
import { INDUSTRIAL_MODULES } from "./industrial.ts";
import { WOODLAND_MODULES } from "./woodland.ts";

// Modules are half a chunk wide and four screens tall; the joint keeps a 4-column landing (2 each
// side, Chibi is 2 wide) under 6 clear rows.
export const MODULE_RULES: ModuleRules = {
  cols: CHUNK_COLS / 2,
  joint: { footing: 2, headroom: 6 },
  rows: FOUR_SCREEN_ROWS,
};

// Every authored module by id. Families add theirs here as they land.
export const MODULES: Readonly<Record<string, ChunkModule>> = {
  ...APARTMENT_MODULES,
  ...BLUE_MODULES,
  ...COUNTRYSIDE_MODULES,
  ...HOME_MODULES,
  ...INDUSTRIAL_MODULES,
  ...WOODLAND_MODULES,
};

// Grades that replace the derived pair grade, by zone-independent pair id `${left}--${right}`.
// The crosswalk follows only the planter Chibi watches it from: after any other half it compounds
// that half's challenge with the crossing, grade 5, outside Blue's band.
export const PAIR_GRADES: Readonly<Record<string, Difficulty>> = Object.fromEntries(
  Object.values(BLUE_MODULES)
    .filter(({ id, sides }) => sides.includes("left") && id !== "city-planter")
    .map(({ id }) => [`${id}--crosswalk`, 5]),
);
