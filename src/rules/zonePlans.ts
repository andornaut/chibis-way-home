import { BACKGROUND_SECTIONS } from "../data/backgrounds";
import { CHARACTERS } from "../data/characters";
import { CHUNK_RULES, CHUNKS, THEMES } from "../data/chunks";
import { ZONE_ROWS } from "../data/screen";
import { SEAM_ROWS } from "../data/seams";
import type { ZonePlan } from "../data/types";
import { RECIPES, ZONES } from "../data/zones";
import { assembleZone, type ChunkLibrary } from "./assemble";

// The game's chunks and themes.
export const CHUNK_LIBRARY: ChunkLibrary = {
  backgrounds: BACKGROUND_SECTIONS,
  characters: CHARACTERS,
  chunks: CHUNKS,
  rows: ZONE_ROWS,
  rules: CHUNK_RULES,
  seams: SEAM_ROWS,
  themes: THEMES,
};

// The zone key names: hand-built in ZONES, or assembled from its recipe in RECIPES for seed, the
// same for the same seed.
export function zonePlanFor(seed: number, key: string): ZonePlan {
  const plan = ZONES[key];
  if (plan) {
    return plan;
  }
  const recipe = RECIPES[key];
  if (!recipe) {
    throw new Error(`No zone or recipe ${key}`);
  }
  return assembleZone(CHUNK_LIBRARY, seed, key, recipe);
}
