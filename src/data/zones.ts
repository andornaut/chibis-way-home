import {
  BLUE_CHALLENGES,
  BLUE_CONNECTORS,
  blueVerticalId,
  COUNTRYSIDE_CHALLENGES,
  COUNTRYSIDE_CONNECTORS,
  countrysideVerticalId,
  FOUR_SCREEN_ROWS,
  GROUND_CHALLENGES,
  HOME_CHALLENGES,
  HOME_CONNECTORS,
  homeVerticalId,
  INDUSTRIAL_CHALLENGES,
  INDUSTRIAL_CONNECTORS,
  INDUSTRIAL_ROWS,
  industrialCapId,
  industrialTunnelId,
  PATROL_YARDS,
  WOODLAND_CHALLENGES,
  WOODLAND_CONNECTORS,
  woodlandVerticalId,
} from "./chunks";
import { CHUNK_COLS } from "./chunkTemplates";
import type { ChunkPool, StageRecipe } from "./types";
import {
  APARTMENT_ROWS,
  APARTMENT_SPAWN_ROW,
  APARTMENT_STAGE_EXIT,
  apartmentChunkId,
} from "./zone6";

// Zone profiles raise the minimum grade and favour compound challenges along the route.
const ZONE_DIFFICULTY = { max: 4, min: 3 } as const;
const DIFFICULTY_PROFILES = {
  apartment: { difficulty: { max: 5, min: 4 }, difficultyWeights: { 4: 1, 5: 8 } },
  blue: { difficulty: ZONE_DIFFICULTY, difficultyWeights: { 3: 1, 4: 1 } },
  countryside: { difficulty: { max: 5, min: 3 }, difficultyWeights: { 3: 1, 4: 1, 5: 2 } },
  home: { difficulty: { max: 5, min: 4 }, difficultyWeights: { 4: 1, 5: 5 } },
  industrial: { difficulty: { max: 5, min: 3 }, difficultyWeights: { 3: 1, 4: 1, 5: 1 } },
  woodland: { difficulty: { max: 5, min: 4 }, difficultyWeights: { 4: 1, 5: 3 } },
} as const;
const MIN_ENCOUNTER_GAP = 3;
const STAGE_ENCOUNTERS = { first: 0, second: 1, third: 1 } as const;
const STAGE_LENGTH = { max: 16 * CHUNK_COLS, min: 14 * CHUNK_COLS } as const;

const STAGE_CHUNK_POOLS = {
  blue: BLUE_CHALLENGES,
  countryside: COUNTRYSIDE_CHALLENGES,
  home: HOME_CHALLENGES,
  industrial: INDUSTRIAL_CHALLENGES,
  woodland: WOODLAND_CHALLENGES,
} satisfies Readonly<Record<string, ChunkPool>>;
const APARTMENT_CHALLENGE_CHUNKS: ChunkPool = [
  ...GROUND_CHALLENGES,
  ...PATROL_YARDS,
  "compound-double-lift",
  "compound-lift-shuttle",
  "compound-low-ceiling-shuttle",
  "compound-patrol-lift",
  "compound-return-high",
];
const APARTMENT_LENGTH = { max: 12 * CHUNK_COLS, min: 11 * CHUNK_COLS };
const apartmentRecipe = (room: string, theme: string, encounters: number): StageRecipe => ({
  ...DIFFICULTY_PROFILES.apartment,
  chunks: APARTMENT_CHALLENGE_CHUNKS.map(apartmentChunkId),
  doors: [{ count: 1, room }],
  encounters,
  events: [],
  finish: "apartment-floor-finish",
  length: APARTMENT_LENGTH,
  minEncounterGap: MIN_ENCOUNTER_GAP,
  rows: APARTMENT_ROWS,
  spawnCol: 2,
  spawnRow: APARTMENT_SPAWN_ROW,
  stageExit: APARTMENT_STAGE_EXIT,
  start: "apartment-floor-start",
  theme,
});

// Each outdoor zone's middle pool, connectors, cap and middle chunk IDs, and stage height.
const OUTDOOR_PROFILES = {
  blue: {
    capId: blueVerticalId,
    chunkId: blueVerticalId,
    connectors: BLUE_CONNECTORS,
    rows: FOUR_SCREEN_ROWS,
  },
  countryside: {
    capId: countrysideVerticalId,
    chunkId: countrysideVerticalId,
    connectors: COUNTRYSIDE_CONNECTORS,
    rows: FOUR_SCREEN_ROWS,
  },
  home: {
    capId: homeVerticalId,
    chunkId: homeVerticalId,
    connectors: HOME_CONNECTORS,
    rows: FOUR_SCREEN_ROWS,
  },
  industrial: {
    capId: industrialCapId,
    chunkId: industrialTunnelId,
    connectors: INDUSTRIAL_CONNECTORS,
    rows: INDUSTRIAL_ROWS,
  },
  woodland: {
    capId: woodlandVerticalId,
    chunkId: woodlandVerticalId,
    connectors: WOODLAND_CONNECTORS,
    rows: FOUR_SCREEN_ROWS,
  },
} as const;
// An outdoor stage's ordinal in its zone sets its encounter count and gift room.
const STAGE_GIFTS = {
  first: "dash-gift",
  second: "double-jump-gift",
  third: "speedy-gift",
} as const satisfies Record<keyof typeof STAGE_ENCOUNTERS, string>;
const outdoorRecipe = (
  zone: keyof typeof OUTDOOR_PROFILES,
  ordinal: keyof typeof STAGE_ENCOUNTERS,
  stage: string,
): StageRecipe => {
  const { capId, chunkId, connectors, rows } = OUTDOOR_PROFILES[zone];
  return {
    ...DIFFICULTY_PROFILES[zone],
    chunks: [...connectors, ...STAGE_CHUNK_POOLS[zone].map(chunkId)],
    doors: [{ count: 1, room: STAGE_GIFTS[ordinal] }],
    encounters: STAGE_ENCOUNTERS[ordinal],
    events: [],
    finish: capId(`${stage}-finish`),
    length: STAGE_LENGTH,
    minEncounterGap: MIN_ENCOUNTER_GAP,
    rows,
    spawnCol: 2,
    start: capId(`${stage}-start`),
    theme: stage,
  };
};

// Generated stages use one continuous area or ordered floor sections.
export const RECIPES: Readonly<Record<string, StageRecipe>> = {
  "back-streets": outdoorRecipe("home", "second", "back-streets"),
  "city-boundary": outdoorRecipe("blue", "third", "city-boundary"),
  "city-outskirts": outdoorRecipe("home", "first", "city-outskirts"),
  "city-streets": outdoorRecipe("blue", "second", "city-streets"),
  "country-lanes": outdoorRecipe("countryside", "second", "country-lanes"),
  "deep-woods": outdoorRecipe("woodland", "second", "deep-woods"),
  "familiar-neighbourhood": outdoorRecipe("home", "third", "familiar-neighbourhood"),
  farmland: outdoorRecipe("countryside", "first", "farmland"),
  "forest-paths": outdoorRecipe("woodland", "first", "forest-paths"),
  "freight-terminal": outdoorRecipe("industrial", "third", "freight-terminal"),
  "loading-yards": outdoorRecipe("industrial", "second", "loading-yards"),
  lobby: apartmentRecipe("dash-gift", "apartment-lobby", 0),
  // The debug park retains its prototype length and difficulty band.
  // No events exist yet.
  park: {
    difficulty: { max: 4, min: 2 },
    doors: [{ count: 1, room: "test" }],
    events: [],
    finish: "park-finish",
    length: { max: 600, min: 360 },
    spawnCol: 2,
    start: "park-start",
    theme: "park",
  },
  penthouse: apartmentRecipe("speedy-gift", "apartment-penthouse", 1),
  pool: apartmentRecipe("speedy-gift", "apartment-pool", 0),
  ravine: outdoorRecipe("woodland", "third", "ravine"),
  "residential-floors": apartmentRecipe("double-jump-gift", "apartment-residential", 1),
  restaurant: apartmentRecipe("double-jump-gift", "apartment-restaurant", 0),
  "river-crossing": outdoorRecipe("countryside", "third", "river-crossing"),
  spa: apartmentRecipe("dash-gift", "apartment-spa", 0),
  street: { ...outdoorRecipe("blue", "first", "street"), spawnCol: 4 },
  "warehouse-district": outdoorRecipe("industrial", "first", "warehouse-district"),
};
