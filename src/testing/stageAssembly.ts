import type { StageRecipe, ZonePlan } from "../data/types/index.ts";
import { assembleStage, type ChunkLibrary, requirePlanned } from "../rules/stage/index.ts";

// The plan assembleStage gives, for fixtures and certification that must assemble. Throws the
// reason when nothing fits.
export function assembleZone(
  library: ChunkLibrary,
  seed: number,
  key: string,
  recipe: StageRecipe,
): ZonePlan {
  return requirePlanned(assembleStage(library, seed, key, recipe)).plan;
}
