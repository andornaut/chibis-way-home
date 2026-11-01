import { CHUNK_COLS } from "./chunkTemplates";
import type { ChunkPool, StageRecipe, ZonePlan } from "./types";

// PLACEHOLDER: parkour test zones, until gameplay designs the real zones.
//
// Every zone is 60 rows, starts on the ground at the bottom left and clears at its right edge.
// Each solid runs down to the bottom row, so every gap is a pit she falls out of. Rises and gaps
// are in tiles, from the top of the ground she leaves to the top of the ledge she lands on: a tap
// rises 3, a full jump 6, and a running jump crosses 19. Every mover's path is 2 tiles from every
// solid and every other mover's path, so a mover never meets her box where she stands at an edge.
// The noCross pairs mark jumps that must remain impossible, accounting for the speed carried
// from a mover on takeoff.
export const TEST_ZONES: readonly ZonePlan[] = [
  // Ledges.
  {
    areas: {
      main: {
        cols: 138,
        entries: { start: { col: 3, row: 56 } },
        objects: [],
        rows: 60,
        solids: [
          // Tap steps: up 3, then up 3 again (the tap's reach).
          { col: 0, cols: 12, row: 56, rows: 4 },
          { col: 12, cols: 6, row: 53, rows: 7 },
          { col: 18, cols: 6, row: 50, rows: 10 },
          // Full jump steps: up 5, then up 6 (the jump's reach).
          { col: 24, cols: 6, row: 45, rows: 15 },
          { col: 30, cols: 10, row: 39, rows: 21 },
          // Gaps at the same height: 6, 12, then 18.
          { col: 46, cols: 10, row: 39, rows: 21 },
          { col: 68, cols: 10, row: 39, rows: 21 },
          // A gap of 18, below the running jump's reach.
          { col: 96, cols: 10, row: 39, rows: 21 },
          // Climb to the upper screen: three full jumps of 6.
          { col: 106, cols: 6, row: 33, rows: 27 },
          { col: 112, cols: 6, row: 27, rows: 33 },
          { col: 118, cols: 20, row: 21, rows: 39 },
        ],
      },
    },
    start: { area: "main", entry: "start" },
  },
  // Hazards.
  {
    areas: {
      main: {
        cols: 211,
        entries: { start: { col: 3, row: 56 } },
        // She can't jump past the narrow landing.
        noCross: [{ from: { col: 98, row: 52 }, to: { col: 131, row: 52 } }],
        objects: [
          // Hazard strips on the ground under gaps of 8 and 16.
          { character: "test-hazard", col: 18, cols: 8, row: 55, rows: 1 },
          { character: "test-hazard", col: 32, cols: 16, row: 55, rows: 1 },
          // Hazard blocks on a ledge to jump over: 3 tall, then 4 tall.
          { character: "test-hazard", col: 54, cols: 2, row: 49, rows: 3 },
          { character: "test-hazard", col: 66, cols: 2, row: 48, rows: 4 },
          // A hazard post in a gap of 14, 3 above the ledges either side.
          { character: "test-hazard", col: 86, cols: 2, row: 49, rows: 11 },
          // A narrow landing, 4 wide, between two hazard posts 2 above it.
          { character: "test-hazard", col: 111, cols: 2, row: 50, rows: 10 },
          { character: "test-hazard", col: 117, cols: 2, row: 50, rows: 10 },
          // A high hazard ceiling above a tiny ledge: the minimum hop clears the ledge beneath it,
          // while a full jump touches the ceiling.
          { character: "test-hazard", col: 131, cols: 17, row: 41, rows: 2 },
        ],
        rows: 60,
        solids: [
          { col: 0, cols: 12, row: 56, rows: 4 },
          // Gaps of 8 and 16 at the same height over hazard strips.
          { col: 12, cols: 6, row: 52, rows: 8 },
          { col: 18, cols: 8, row: 56, rows: 4 },
          { col: 26, cols: 6, row: 52, rows: 8 },
          { col: 32, cols: 16, row: 56, rows: 4 },
          // The ledge with hazard blocks, then a gap of 14 over a hazard post.
          { col: 48, cols: 32, row: 52, rows: 8 },
          { col: 94, cols: 10, row: 52, rows: 8 },
          // The narrow landing: gaps of 9 to it and 10 from it, 23 in all, beyond the running reach.
          { col: 113, cols: 4, row: 52, rows: 8 },
          // The tiny ledge under the hazard ceiling: a rise of 1 from the floor.
          { col: 127, cols: 12, row: 52, rows: 8 },
          { col: 139, cols: 26, row: 51, rows: 9 },
          // Climb to the upper screen: five full jumps of 6.
          { col: 165, cols: 6, row: 45, rows: 15 },
          { col: 171, cols: 6, row: 39, rows: 21 },
          { col: 177, cols: 6, row: 33, rows: 27 },
          { col: 183, cols: 6, row: 27, rows: 33 },
          { col: 189, cols: 22, row: 21, rows: 39 },
        ],
      },
    },
    start: { area: "main", entry: "start" },
  },
  // Single movers, each between two solid ledges.
  {
    areas: {
      main: {
        cols: 132,
        entries: { start: { col: 3, row: 56 } },
        // Neither gap a horizontal mover crosses can be jumped without it.
        noCross: [
          { from: { col: 25, row: 42 }, to: { col: 62, row: 42 } },
          { from: { col: 80, row: 26 }, to: { col: 121, row: 26 } },
        ],
        objects: [
          // A vertical mover lifts her 14, from the ground to a ledge.
          {
            character: "test-mover",
            col: 14,
            cols: 4,
            overrides: { motion: { direction: "up", distance: 14, pause: 1, speed: 3.5 } },
            phase: 0,
            row: 56,
            rows: 1,
          },
          // A horizontal mover 4 above the ledges across a gap of 28: she can jump up onto it only
          // while it is near. The far ledge is 6 past its track's end: a mover running into her
          // side while she stands still in the air puts her on its far side, and from there she
          // must not reach the ledge.
          {
            character: "test-mover",
            col: 34,
            cols: 6,
            overrides: { motion: { direction: "right", distance: 12, pause: 1, speed: 4 } },
            phase: 0,
            row: 38,
            rows: 1,
          },
          // A vertical mover lifts her 16, into the upper screen.
          {
            character: "test-mover",
            col: 70,
            cols: 4,
            overrides: { motion: { direction: "up", distance: 16, pause: 1, speed: 4 } },
            phase: 0,
            row: 42,
            rows: 1,
          },
          // A horizontal mover level with the ledges across a gap of 28, to the end. Its near end
          // is 4 from the ledge, so she jumps on rather than walking off onto it.
          {
            character: "test-mover",
            col: 90,
            cols: 6,
            overrides: { motion: { direction: "right", distance: 16, pause: 1, speed: 4 } },
            phase: 0,
            row: 26,
            rows: 1,
          },
        ],
        rows: 60,
        solids: [
          { col: 0, cols: 12, row: 56, rows: 4 },
          { col: 20, cols: 10, row: 42, rows: 18 },
          { col: 58, cols: 10, row: 42, rows: 18 },
          { col: 76, cols: 10, row: 26, rows: 34 },
          { col: 114, cols: 18, row: 26, rows: 34 },
        ],
      },
    },
    start: { area: "main", entry: "start" },
  },
  // Mover to mover transfers, with no solid ledge between them, easiest first. The movers in each
  // chain share a round trip (8 s for the lifts' chain, 5 s for the last pair), so each meeting
  // comes round once a cycle, and she waits for it by riding.
  {
    areas: {
      main: {
        cols: 138,
        entries: { start: { col: 3, row: 56 } },
        // Each transfer can't be skipped: the first lift to the second (marked by where their
        // tracks start), the ledge to the second horizontal mover, and the first horizontal mover
        // to the end ledge.
        noCross: [
          { from: { col: 15, row: 56 }, to: { col: 45, row: 42 } },
          { from: { col: 60, row: 16 }, to: { col: 95, row: 12 } },
          { from: { col: 71, row: 16 }, to: { col: 125, row: 12 } },
        ],
        objects: [
          // Vertical to horizontal: the lift pauses at its top as the horizontal mover, 2 higher and
          // 4 across, pauses at its near end. The lifts either side are 26 apart.
          {
            character: "test-mover",
            col: 14,
            cols: 4,
            overrides: { motion: { direction: "up", distance: 12, pause: 1, speed: 4 } },
            phase: 0.375,
            row: 56,
            rows: 1,
          },
          {
            character: "test-mover",
            col: 22,
            cols: 6,
            overrides: { motion: { direction: "right", distance: 12, pause: 1, speed: 4 } },
            phase: 0.875,
            row: 42,
            rows: 1,
          },
          // Horizontal to vertical: the next lift reaches its bottom, level with the horizontal
          // mover and 4 across, as that mover ends its pause at its far end.
          {
            character: "test-mover",
            col: 44,
            cols: 4,
            overrides: { motion: { direction: "up", distance: 12, pause: 1, speed: 4 } },
            phase: 0.25,
            row: 42,
            rows: 1,
          },
          // Vertical to vertical: a second lift 2 across, without pauses, moves opposite to the
          // first, from 2 below the first's top to 4 below the ledge. She jumps up 4 from its top to
          // the ledge.
          {
            character: "test-mover",
            col: 50,
            cols: 4,
            overrides: { motion: { direction: "up", distance: 12, pause: 0, speed: 3 } },
            phase: 0.8125,
            row: 32,
            rows: 1,
          },
          // Horizontal to horizontal, opposite directions, fastest: the second, 4 higher and 2
          // across, pauses at its near end as the first pauses at its far end, then carries her to
          // the end ledge. Their round trip is 5 s. The ledge is 26 from the second's near end,
          // and the first's far end is 26 from the end ledge.
          {
            character: "test-mover",
            col: 70,
            cols: 6,
            overrides: { motion: { direction: "right", distance: 16, pause: 0.5, speed: 8 } },
            phase: 0.4,
            row: 16,
            rows: 1,
          },
          {
            character: "test-mover",
            col: 94,
            cols: 6,
            overrides: { motion: { direction: "right", distance: 16, pause: 0.5, speed: 8 } },
            phase: 0.9,
            row: 12,
            rows: 1,
          },
        ],
        rows: 60,
        solids: [
          { col: 0, cols: 12, row: 56, rows: 4 },
          { col: 56, cols: 12, row: 16, rows: 44 },
          { col: 118, cols: 20, row: 12, rows: 48 },
        ],
      },
    },
    start: { area: "main", entry: "start" },
  },
  // A street 10 screens wide: a door to the test room, then a cart wandering its floor.
  {
    areas: {
      street: {
        cols: 600,
        entries: { start: { col: 3, row: 56 } },
        objects: [
          { character: "test-door", col: 228, room: "test", row: 52 },
          { character: "test-cart", col: 280, row: 54 },
        ],
        rows: 60,
        solids: [{ col: 0, cols: 600, row: 56, rows: 4 }],
      },
    },
    start: { area: "street", entry: "start" },
  },
];

// The zones the map leads to, by key.
export const ZONES: Readonly<Record<string, ZonePlan>> = {};

// Zone profiles raise the minimum grade and favour compound challenges along the route.
export const ZONE_DIFFICULTY = { max: 4, min: 3 } as const;
const DIFFICULTY_PROFILES = {
  apartment: { difficulty: { max: 5, min: 4 }, difficultyWeights: { 4: 1, 5: 8 } },
  blue: { difficulty: ZONE_DIFFICULTY, difficultyWeights: { 3: 1, 4: 1 } },
  countryside: { difficulty: { max: 5, min: 3 }, difficultyWeights: { 3: 1, 4: 1, 5: 2 } },
  home: { difficulty: { max: 5, min: 4 }, difficultyWeights: { 4: 1, 5: 5 } },
  industrial: { difficulty: { max: 5, min: 3 }, difficultyWeights: { 3: 1, 4: 1, 5: 1 } },
  woodland: { difficulty: { max: 5, min: 4 }, difficultyWeights: { 4: 1, 5: 3 } },
} as const;
const STAGE_ENCOUNTERS = { first: 0, later: 1 } as const;
const STAGE_LENGTH = { max: 16 * CHUNK_COLS, min: 14 * CHUNK_COLS } as const;

function sectionLength(count: number, index: number) {
  const minChunks = STAGE_LENGTH.min / CHUNK_COLS;
  const maxChunks = STAGE_LENGTH.max / CHUNK_COLS;
  return {
    max: (Math.floor(maxChunks / count) + (index < maxChunks % count ? 1 : 0)) * CHUNK_COLS,
    min: (Math.floor(minChunks / count) + (index < minChunks % count ? 1 : 0)) * CHUNK_COLS,
  };
}

const GROUND_CHALLENGES: ChunkPool = [
  "city-boundary-ground-hazard",
  "compound-ascent",
  "compound-compact-ascent",
  "compound-compact-climb",
  "compound-low-ceiling-hazard",
  "compound-return-terrace",
];
const JUMP_CHALLENGES: ChunkPool = [
  "city-boundary-edge-yard",
  "city-boundary-gaps",
  "city-boundary-jumps",
  "city-boundary-low-ceiling",
  "city-boundary-return-gap",
  "city-boundary-steps",
  "city-boundary-upper-climb",
];
const PATROL_YARDS: ChunkPool = [
  "city-boundary-climb-yard",
  "city-boundary-dog-high",
  "city-boundary-dog-terrace",
  "patrol-cover-early",
  "patrol-cover-late",
  "patrol-cover-middle",
];
const STAGE_CHUNK_POOLS = {
  blue: [
    ...GROUND_CHALLENGES,
    ...JUMP_CHALLENGES,
    ...PATROL_YARDS,
    "city-boundary-lift",
    "city-boundary-shuttle",
    "compound-return-shuttle",
  ],
  countryside: [
    ...GROUND_CHALLENGES,
    ...JUMP_CHALLENGES,
    ...PATROL_YARDS,
    "city-boundary-shuttle",
    "compound-low-ceiling-shuttle",
    "compound-return-high",
    "compound-return-shuttle",
  ],
  home: [
    ...GROUND_CHALLENGES,
    "climbing-enemy-lane",
    "compound-double-lift",
    "compound-low-ceiling-shuttle",
    "compound-return-high",
    "compound-vertical-yard",
    "vertical-stack-early",
    "vertical-stack-late",
    "vertical-stack-middle",
  ],
  industrial: [
    ...GROUND_CHALLENGES,
    ...JUMP_CHALLENGES,
    "bounded-flyer-post",
    "city-boundary-lift",
    "city-boundary-shuttle",
    "compound-double-lift",
    "compound-lift-shuttle",
    "compound-low-ceiling-shuttle",
    "compound-perch-yard",
    "compound-return-high",
    "flyer-shelter-early",
    "flyer-shelter-late",
    "flyer-shelter-middle",
  ],
  woodland: [
    ...GROUND_CHALLENGES,
    "compound-double-lift",
    "compound-low-ceiling-shuttle",
    "compound-return-high",
    "compound-return-shuttle",
    "growl-clearing",
    "growl-cover-early",
    "growl-cover-late",
    "growl-cover-middle",
  ],
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
const APARTMENT_CAPS = {
  finish: "apartment-finish",
  start: "apartment-start",
  transitionRoles: { left: "transition-down", right: "transition-up" },
} as const;
const APARTMENT_ROOM_DOORS = [{ count: 1, room: "test" }] as const;
const APARTMENT_SECTION_DEFAULTS = {
  ...DIFFICULTY_PROFILES.apartment,
  doors: [],
  events: [],
  spawnCol: 2,
} as const;

// Generated stages use one continuous area or ordered floor sections.
export const RECIPES: Readonly<Record<string, StageRecipe>> = {
  "back-streets": {
    ...DIFFICULTY_PROFILES.home,
    chunks: STAGE_CHUNK_POOLS.home,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.later,
    events: [],
    finish: "back-streets-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "back-streets-start",
    theme: "back-streets",
  },
  "city-boundary": {
    ...DIFFICULTY_PROFILES.blue,
    chunks: STAGE_CHUNK_POOLS.blue,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.later,
    events: [],
    finish: "city-boundary-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "city-boundary-start",
    theme: "city-boundary",
  },
  "city-outskirts": {
    ...DIFFICULTY_PROFILES.home,
    chunks: STAGE_CHUNK_POOLS.home,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.first,
    events: [],
    finish: "city-outskirts-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "city-outskirts-start",
    theme: "city-outskirts",
  },
  "city-streets": {
    ...DIFFICULTY_PROFILES.blue,
    chunks: STAGE_CHUNK_POOLS.blue,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.later,
    events: [],
    finish: "city-streets-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "city-streets-start",
    theme: "city-streets",
  },
  "climb-to-apartment": {
    ...APARTMENT_CAPS,
    encounters: STAGE_ENCOUNTERS.later,
    sections: [
      {
        ...APARTMENT_SECTION_DEFAULTS,
        chunks: APARTMENT_CHALLENGE_CHUNKS,
        doors: APARTMENT_ROOM_DOORS,
        id: "fire-escape-2",
        length: sectionLength(4, 0),
        theme: "apartment-exterior",
      },
      {
        ...APARTMENT_SECTION_DEFAULTS,
        chunks: APARTMENT_CHALLENGE_CHUNKS,
        id: "spa",
        length: sectionLength(4, 1),
        theme: "apartment-spa",
      },
      {
        ...APARTMENT_SECTION_DEFAULTS,
        chunks: APARTMENT_CHALLENGE_CHUNKS,
        id: "fire-escape-3",
        length: sectionLength(4, 2),
        theme: "apartment-exterior",
      },
      {
        ...APARTMENT_SECTION_DEFAULTS,
        chunks: APARTMENT_CHALLENGE_CHUNKS,
        id: "residential",
        length: sectionLength(4, 3),
        theme: "apartment-residential",
      },
    ],
  },
  "country-lanes": {
    ...DIFFICULTY_PROFILES.countryside,
    chunks: STAGE_CHUNK_POOLS.countryside,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.later,
    events: [],
    finish: "country-lanes-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "country-lanes-start",
    theme: "country-lanes",
  },
  "deep-woods": {
    ...DIFFICULTY_PROFILES.woodland,
    chunks: STAGE_CHUNK_POOLS.woodland,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.later,
    events: [],
    finish: "deep-woods-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "deep-woods-start",
    theme: "deep-woods",
  },
  "entrance-and-lobby": {
    ...APARTMENT_CAPS,
    encounters: STAGE_ENCOUNTERS.first,
    finish: "apartment-quiet-finish",
    sections: [
      {
        ...APARTMENT_SECTION_DEFAULTS,
        chunks: APARTMENT_CHALLENGE_CHUNKS,
        doors: APARTMENT_ROOM_DOORS,
        id: "entrance",
        length: sectionLength(2, 0),
        theme: "apartment-entrance",
      },
      {
        ...APARTMENT_SECTION_DEFAULTS,
        chunks: APARTMENT_CHALLENGE_CHUNKS,
        id: "lobby",
        length: sectionLength(2, 1),
        theme: "apartment-lobby",
      },
    ],
  },
  "familiar-neighbourhood": {
    ...DIFFICULTY_PROFILES.home,
    chunks: STAGE_CHUNK_POOLS.home,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.later,
    events: [],
    finish: "familiar-neighbourhood-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "familiar-neighbourhood-start",
    theme: "familiar-neighbourhood",
  },
  farmland: {
    ...DIFFICULTY_PROFILES.countryside,
    chunks: STAGE_CHUNK_POOLS.countryside,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.first,
    events: [],
    finish: "farmland-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "farmland-start",
    theme: "farmland",
  },
  "forest-paths": {
    ...DIFFICULTY_PROFILES.woodland,
    chunks: STAGE_CHUNK_POOLS.woodland,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.first,
    events: [],
    finish: "forest-paths-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "forest-paths-start",
    theme: "forest-paths",
  },
  "freight-terminal": {
    ...DIFFICULTY_PROFILES.industrial,
    chunks: STAGE_CHUNK_POOLS.industrial,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.later,
    events: [],
    finish: "freight-terminal-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "freight-terminal-start",
    theme: "freight-terminal",
  },
  // The debug park retains its prototype length and difficulty band.
  // No events exist yet.
  "loading-yards": {
    ...DIFFICULTY_PROFILES.industrial,
    chunks: STAGE_CHUNK_POOLS.industrial,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.later,
    events: [],
    finish: "loading-yards-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "loading-yards-start",
    theme: "loading-yards",
  },
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
  ravine: {
    ...DIFFICULTY_PROFILES.woodland,
    chunks: STAGE_CHUNK_POOLS.woodland,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.later,
    events: [],
    finish: "ravine-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "ravine-start",
    theme: "ravine",
  },
  "river-crossing": {
    ...DIFFICULTY_PROFILES.countryside,
    chunks: STAGE_CHUNK_POOLS.countryside,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.later,
    events: [],
    finish: "river-crossing-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "river-crossing-start",
    theme: "river-crossing",
  },
  "shared-floors": {
    ...APARTMENT_CAPS,
    encounters: STAGE_ENCOUNTERS.later,
    finish: "apartment-shared-finish",
    sections: [
      {
        ...APARTMENT_SECTION_DEFAULTS,
        chunks: APARTMENT_CHALLENGE_CHUNKS,
        doors: APARTMENT_ROOM_DOORS,
        id: "restaurant",
        length: sectionLength(3, 0),
        theme: "apartment-restaurant",
      },
      {
        ...APARTMENT_SECTION_DEFAULTS,
        chunks: APARTMENT_CHALLENGE_CHUNKS,
        id: "fire-escape-1",
        length: sectionLength(3, 1),
        theme: "apartment-exterior",
      },
      {
        ...APARTMENT_SECTION_DEFAULTS,
        chunks: APARTMENT_CHALLENGE_CHUNKS,
        id: "pool",
        length: sectionLength(3, 2),
        theme: "apartment-pool",
      },
    ],
    start: "apartment-intro-start",
  },
  street: {
    ...DIFFICULTY_PROFILES.blue,
    chunks: STAGE_CHUNK_POOLS.blue,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.first,
    events: [],
    finish: "street-finish",
    length: STAGE_LENGTH,
    spawnCol: 4,
    start: "street-start",
    theme: "street",
  },
  "warehouse-district": {
    ...DIFFICULTY_PROFILES.industrial,
    chunks: STAGE_CHUNK_POOLS.industrial,
    doors: [{ count: 1, room: "test" }],
    encounters: STAGE_ENCOUNTERS.first,
    events: [],
    finish: "warehouse-district-finish",
    length: STAGE_LENGTH,
    spawnCol: 2,
    start: "warehouse-district-start",
    theme: "warehouse-district",
  },
};
