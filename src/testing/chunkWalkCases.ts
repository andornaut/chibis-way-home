import { BIRD_FRAME } from "../assets";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { ObjectLayout, SlotKind, ZoneLayout } from "../data/types";
import { type ChunkLibrary, themesOf, zonePlanOf } from "../rules/assemble";
import { applyStageGeometry } from "../rules/stageGeometry";
import { zoneLayout } from "../rules/tiles";
import { type ALL_CHUNKS, ALL_RECIPES } from "./chunks";
import { CATALOGUE, HITBOXES, TILESETS } from "./walkSuite";

type ChunkWalkCase = (typeof ALL_CHUNKS)[number];

export function chunkWalkPlan(
  fills: Readonly<Record<SlotKind, readonly string[]>>,
  [, library, chunk]: ChunkWalkCase,
) {
  const only: ChunkLibrary = { ...library, chunks: { chunk } };
  const plan = zonePlanOf(only, () => 0, fills, themesOf(chunk)[0] ?? "", 2, ["chunk"]);
  const spawnRows = new Set(
    ALL_RECIPES.flatMap(([, source, recipe]) =>
      source === library && !("sections" in recipe) && source.chunks[recipe.start] === chunk
        ? [recipe.spawnRow]
        : [],
    ),
  );
  if (spawnRows.size > 1) {
    throw new Error("Standalone opening requires one production spawn row");
  }
  const [spawnRow] = spawnRows;
  return spawnRow === undefined ? plan : applyStageGeometry({ spawnRow }, plan);
}

// Keep physical object slots: their original indices select deterministic motion streams.
function physicalObject(object: ObjectLayout): ObjectLayout | null {
  return object.collision === "none" &&
    object.interaction.kind === "none" &&
    object.reaction.kind === "none" &&
    object.behaviour === undefined &&
    object.contact === undefined &&
    object.orbit === undefined &&
    object.scene === undefined &&
    object.motion.algorithm === "static" &&
    object.quirks.length === 0 &&
    object.spawnTemplates === undefined
    ? null
    : object;
}

export function chunkWalkPhysics(subject: ChunkWalkCase): unknown {
  const layout: ZoneLayout = zoneLayout(
    TILE,
    BIRD_FRAME,
    CATALOGUE,
    HITBOXES,
    TILESETS,
    new Set(),
    chunkWalkPlan({ door: [], event: [] }, subject),
  );
  return {
    tuning: BIRD,
    ...layout,
    areas: Object.fromEntries(
      Object.entries(layout.areas).map(([key, area]) => {
        const hosts = new Set(
          area.objects.flatMap((object) => (object.orbit ? [object.orbit.host] : [])),
        );
        const objects = area.objects.map((object, index) =>
          hosts.has(index) ? object : physicalObject(object),
        );
        while (objects.at(-1) === null) {
          objects.pop();
        }
        return [key, { ...area, objects, terrain: undefined, tileset: undefined }];
      }),
    ),
    marks: Object.fromEntries(
      Object.entries(chunkWalkPlan({ door: [], event: [] }, subject).areas).map(([key, area]) => [
        key,
        { noCross: area.noCross ?? [], outOfReach: area.outOfReach ?? [] },
      ]),
    ),
  };
}

// Candidate names apply only to the empty-slot standalone profile.
// Compare full physics within the same required-target and x-range profile before sharing a walk.
export const CHUNK_WALK_EQUIVALENTS: Readonly<Record<string, string>> = {
  "back-streets-start": "country-lanes-start",
  "blue-vertical-city-streets-finish": "blue-vertical-city-boundary-finish",
  "city-boundary-ground-hazard-woodland-depth": "city-boundary-ground-hazard-exterior",
  "city-outskirts-finish": "back-streets-finish",
  "city-outskirts-start": "city-boundary-start",
  "city-streets-finish": "city-boundary-finish",
  "city-streets-start": "country-lanes-start",
  "compound-low-ceiling-hazard-woodland-depth": "compound-low-ceiling-hazard-exterior",
  "compound-return-terrace-woodland-depth": "compound-return-terrace-exterior",
  "deep-woods-start": "country-lanes-start",
  "familiar-neighbourhood-finish": "back-streets-finish",
  "familiar-neighbourhood-start": "city-boundary-start",
  "farmland-finish": "country-lanes-finish",
  "fixture test-start": "fixture test-finish",
  "forest-paths-finish": "deep-woods-finish",
  "forest-paths-start": "city-boundary-start",
  "freight-terminal-start": "city-boundary-start",
  "horizontal-platform-orbit-woodland-depth": "horizontal-platform-orbit-exterior",
  "industrial-deep-ascent": "outdoor-deep-ascent",
  "industrial-deep-descent": "outdoor-deep-descent",
  "industrial-descent": "outdoor-descent",
  "industrial-tall-freight-terminal-start": "blue-vertical-city-boundary-start",
  "industrial-tall-loading-yards-finish": "industrial-tall-freight-terminal-finish",
  "industrial-tall-loading-yards-start": "blue-vertical-city-streets-start",
  "industrial-tall-warehouse-district-finish": "industrial-tall-freight-terminal-finish",
  "industrial-tall-warehouse-district-start": "blue-vertical-city-boundary-start",
  "loading-yards-finish": "freight-terminal-finish",
  "loading-yards-start": "country-lanes-start",
  "ravine-finish": "deep-woods-finish",
  "ravine-start": "city-boundary-start",
  "river-crossing-finish": "country-lanes-finish",
  "river-crossing-start": "farmland-start",
  "warehouse-district-finish": "freight-terminal-finish",
  "warehouse-district-start": "city-boundary-start",
};
