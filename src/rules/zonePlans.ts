import { BACKGROUND_SECTIONS } from "../data/backgrounds";
import { CERTIFIED_LISTS } from "../data/certified";
import { CHARACTERS } from "../data/characters";
import { CHUNK_RULES, CHUNKS, THEMES } from "../data/chunks";
import { MODULE_RULES, MODULES, PAIR_GRADES } from "../data/modules";
import { ZONE_ROWS } from "../data/screen";
import { SEAM_ROWS } from "../data/seams";
import type { StageRecipe, ZoneKey, ZonePlan } from "../data/types";
import { ZONE_FRAMES } from "../data/zoneFrames";
import { RECIPES } from "../data/zones";
import { assembleZoneAvoiding, type ChunkLibrary } from "./assemble";
import { certifiedChunks } from "./modules";

const CERTIFIED = certifiedChunks(
  { frames: ZONE_FRAMES, grades: PAIR_GRADES, modules: MODULES, rules: MODULE_RULES },
  CERTIFIED_LISTS,
);

// The game's chunks, certified pairs included, and themes.
export const CHUNK_LIBRARY: ChunkLibrary = {
  backgrounds: BACKGROUND_SECTIONS,
  characters: CHARACTERS,
  chunks: { ...CHUNKS, ...CERTIFIED.chunks },
  rows: ZONE_ROWS,
  rules: CHUNK_RULES,
  seams: SEAM_ROWS,
  themes: THEMES,
};

// The zone whose frame draws a stage theme, if any.
export function zoneOfTheme(theme: string): ZoneKey | undefined {
  return (Object.keys(ZONE_FRAMES) as ZoneKey[]).find((zone) =>
    ZONE_FRAMES[zone].themes.includes(theme),
  );
}

// A recipe with its zone's certified pairs after its authored pool.
function withCertifiedPairs(recipe: StageRecipe): StageRecipe {
  if ("sections" in recipe || recipe.chunks === undefined) {
    return recipe;
  }
  const zone = zoneOfTheme(recipe.theme);
  const pairs = (zone && CERTIFIED.pools[zone]?.filter((id) => id in CERTIFIED.chunks)) ?? [];
  return pairs.length === 0 ? recipe : { ...recipe, chunks: [...recipe.chunks, ...pairs] };
}

// Every stage recipe as the game assembles it, certified pairs included.
export const STAGE_RECIPES: Readonly<Record<string, StageRecipe>> = Object.fromEntries(
  Object.entries(RECIPES).map(([key, recipe]) => [key, withCertifiedPairs(recipe)]),
);

// The zone key names, assembled from its recipe in STAGE_RECIPES for seed, the same for the same
// seed.
export function zonePlanFor(seed: number, key: string): ZonePlan {
  return zonePlanAvoiding([], seed, key);
}

// zonePlanFor without the avoided middle chunks while an assembly fits without them
// (assembleZoneAvoiding), the same for the same seed and avoided chunks.
export function zonePlanAvoiding(avoid: readonly string[], seed: number, key: string): ZonePlan {
  const recipe = STAGE_RECIPES[key];
  if (!recipe) {
    throw new Error(`No recipe ${key}`);
  }
  return assembleZoneAvoiding(CHUNK_LIBRARY, avoid, seed, key, recipe);
}
