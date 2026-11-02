import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { ObjectLayout, ZoneLayout } from "../data/types";
import { type ChunkLibrary, themesOf, zonePlanOf } from "../rules/assemble";
import { zoneLayout } from "../rules/tiles";
import { BIRD_FRAME } from "../view/bird";
import type { ALL_CHUNKS } from "./chunks";
import { CATALOGUE, HITBOXES, TILESETS } from "./walkSuite";

export type ChunkWalkCase = (typeof ALL_CHUNKS)[number];

export function chunkWalkPlan([, library, chunk]: ChunkWalkCase) {
  const only: ChunkLibrary = { ...library, chunks: { chunk } };
  return zonePlanOf(only, () => 0, { door: [], event: [] }, themesOf(chunk)[0] ?? "", 2, ["chunk"]);
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
    chunkWalkPlan(subject),
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
      Object.entries(chunkWalkPlan(subject).areas).map(([key, area]) => [
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
  "city-boundary-ground-hazard-woodland-depth": "city-boundary-ground-hazard-exterior",
  "city-outskirts-finish": "back-streets-finish",
  "city-outskirts-start": "city-boundary-start",
  "city-streets-finish": "city-boundary-finish",
  "city-streets-start": "country-lanes-start",
  "compound-low-ceiling-hazard-woodland-depth": "compound-low-ceiling-hazard-exterior",
  "compound-low-ceiling-shuttle-woodland-depth": "compound-low-ceiling-shuttle-exterior",
  "compound-return-terrace-woodland-depth": "compound-return-terrace-exterior",
  "deep-woods-start": "country-lanes-start",
  "familiar-neighbourhood-finish": "back-streets-finish",
  "familiar-neighbourhood-start": "city-boundary-start",
  "farmland-finish": "country-lanes-finish",
  "fixture test-flat-50": "fixture test-finish",
  "fixture test-start": "fixture test-finish",
  "forest-paths-finish": "deep-woods-finish",
  "forest-paths-start": "city-boundary-start",
  "freight-terminal-start": "city-boundary-start",
  "horizontal-platform-orbit-woodland-depth": "horizontal-platform-orbit-exterior",
  "loading-yards-finish": "freight-terminal-finish",
  "loading-yards-start": "country-lanes-start",
  "ravine-finish": "deep-woods-finish",
  "ravine-start": "city-boundary-start",
  "river-crossing-finish": "country-lanes-finish",
  "river-crossing-start": "farmland-start",
  "warehouse-district-finish": "freight-terminal-finish",
  "warehouse-district-start": "city-boundary-start",
};
