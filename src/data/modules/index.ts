import { FOUR_SCREEN_ROWS } from "../chunks";
import { CHUNK_COLS } from "../chunkTemplates";
import type { ChunkModule, Difficulty, ModuleRules } from "../types";
import { BLUE_MODULES } from "./blue";

// Modules are half a chunk wide and four screens tall; the joint keeps a 4-column landing (2 each
// side, Chibi is 2 wide) under 6 clear rows.
export const MODULE_RULES: ModuleRules = {
  cols: CHUNK_COLS / 2,
  joint: { footing: 2, headroom: 6 },
  rows: FOUR_SCREEN_ROWS,
};

// Every authored module by id. Families add theirs here as they land.
export const MODULES: Readonly<Record<string, ChunkModule>> = { ...BLUE_MODULES };

// Grades that replace the derived pair grade, by zone-independent pair id `${left}--${right}`.
export const PAIR_GRADES: Readonly<Record<string, Difficulty>> = {};
