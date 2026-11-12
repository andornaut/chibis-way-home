// Small chunks, a theme and a recipe for the chunk tests, which run on these as well as on
// gameplay's chunks and recipes.
import { ARCHETYPES } from "../data/archetypes.ts";
import { CHARACTERS } from "../data/characters.ts";
import { CHUNK_RULES, CHUNKS, THEMES } from "../data/chunks.ts";
import { GANTRY_RIDE_TRANSIT } from "../data/forcedTransit.ts";
import {
  AWNING_BEHAVIOUR,
  AWNING_SECONDS,
  awningCycle,
  CROSSWALK_BEHAVIOUR,
  GANTRY_BEHAVIOUR,
  GUST_BEHAVIOUR,
  GUST_SECONDS,
  gustCycle,
} from "../data/obstacleBehaviours.ts";
import { CROSSWALK_PHASE_TILES, CROSSWALK_SIGNAL_ANIMATIONS } from "../data/obstacleCharacters.ts";
import {
  CHANDELIER_SWING,
  chandelierOrbit,
  GUST_PULSE,
  WINDMILL_SAILS,
  windmillSailOrbit,
} from "../data/obstacleTuning.ts";
import { REACH } from "../data/reach.ts";
import { ZONE_ROWS } from "../data/screen.ts";
import { SEAM_ROWS } from "../data/seams.ts";
import type {
  Character,
  ChunkPlan,
  Instance,
  StageRecipe,
  TerrainRect,
  ThemePlan,
  ZoneRecipe,
} from "../data/types/index.ts";
import type { ChunkLibrary } from "../rules/assemble.ts";
import { pendulumAngle } from "../rules/orbit.ts";
import { CHUNK_LIBRARY, STAGE_RECIPES } from "../rules/zonePlans.ts";

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
const WIDE_BANK_COLS = 21;
const WIDE_LANDING_COL = WIDE_BANK_COLS + REACH.gap;

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
    solids: [
      ground(0, WIDE_BANK_COLS, 50),
      ground(WIDE_LANDING_COL, CHUNK_RULES.cols.max - WIDE_LANDING_COL, 50),
    ],
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

// The crosswalk engine's fixture, outside the shared fixture pool until its characters reach
// CHARACTERS with their art: a strip on the road top between flat kerbs on row 50, with a signal on
// the near kerb that follows the strip's state.
export const CROSSWALK_FIXTURE_CHARACTERS: Readonly<Record<string, Character>> = {
  "test-crosswalk-signal": {
    archetype: "scenery",
    art: "crosswalk-signal",
    cols: 1,
    phaseAnimations: CROSSWALK_SIGNAL_ANIMATIONS,
    rows: 7,
  },
  "test-crosswalk-strip": {
    archetype: "hazard",
    art: "placeholder-hazard",
    behaviour: CROSSWALK_BEHAVIOUR,
    cols: 20,
    contactCue: "red-hazard",
    noJumpOver: true,
    phaseTiles: CROSSWALK_PHASE_TILES,
    rows: 1,
  },
};

export const CROSSWALK_FIXTURE_CATALOGUE = {
  archetypes: ARCHETYPES,
  characters: { ...CHARACTERS, ...CROSSWALK_FIXTURE_CHARACTERS },
};

export const CROSSWALK_FIXTURE_STRIP = { col: 20, cols: 20, row: 49 } as const;

export const CROSSWALK_FIXTURE_LIBRARY: ChunkLibrary = {
  ...FIXTURE_LIBRARY,
  characters: CROSSWALK_FIXTURE_CATALOGUE.characters,
  chunks: {
    "test-crosswalk": {
      cols: 60,
      difficulty: 4,
      encounters: 0,
      entry: { row: 50 },
      exit: { row: 50 },
      objects: [
        { character: "test-crosswalk-strip", id: "strip", ...CROSSWALK_FIXTURE_STRIP },
        { character: "test-crosswalk-signal", col: 18, phaseSource: "strip", row: 43 },
      ],
      solids: [ground(0, 60, 50)],
      theme: "test",
    },
  },
};

// The awning engine's fixture, outside the shared fixture pool until its character reaches
// CHARACTERS with its art: three wall-left awnings across a drop from the entry run (row 50) to the
// exit run, over a lower street (row 58) whose step rejoins the exit. The first starts out and the
// others retracted, so each reads out while Chibi stands on the one before. A second chunk hangs
// one awning at standing height over flat ground.
export const AWNING_FIXTURE_CHARACTERS: Readonly<Record<string, Character>> = {
  "test-awning": {
    archetype: "ledge",
    art: "homecity-awning-ledge",
    behaviour: AWNING_BEHAVIOUR,
    cols: 8,
    rows: 3,
  },
};

export const AWNING_FIXTURE_CATALOGUE = {
  archetypes: ARCHETYPES,
  characters: { ...CHARACTERS, ...AWNING_FIXTURE_CHARACTERS },
};

const RETRACTED_AWNING = awningCycle(AWNING_SECONDS, "retracted");

export const AWNING_FIXTURE_COLS = [17, 27, 37] as const;

export const AWNING_FIXTURE_LIBRARY: ChunkLibrary = {
  ...FIXTURE_LIBRARY,
  characters: AWNING_FIXTURE_CATALOGUE.characters,
  chunks: {
    "test-awning-overhead": {
      cols: 60,
      difficulty: 3,
      encounters: 0,
      entry: { row: 50 },
      exit: { row: 50 },
      objects: [
        {
          behaviour: RETRACTED_AWNING,
          character: "test-awning",
          col: 20,
          row: 47,
        },
      ],
      solids: [ground(0, 60, 50)],
      theme: "test",
    },
    "test-awnings": {
      cols: 60,
      difficulty: 4,
      encounters: 0,
      entry: { row: 50 },
      exit: { row: 50 },
      objects: AWNING_FIXTURE_COLS.map((col, index) => ({
        ...(index > 0 && { behaviour: RETRACTED_AWNING }),
        character: "test-awning",
        col,
        row: 50,
      })),
      solids: [
        ground(0, 15, 50),
        ground(15, 32, 58),
        { col: 45, cols: 2, row: 54, rows: 4 },
        ground(47, 13, 50),
      ],
      theme: "test",
    },
  },
};

// The gantry crane engine's fixture, outside the shared fixture pool until its characters reach
// CHARACTERS with their art: a flat observation half (row 50), then the crane module's near bank,
// a 22-col pit floored with red terrain (row 58) and the far bank. The container docks flush with
// the near bank, its lid level with both bank tops, under a rail 8 rows up. Its first dock pause
// runs 2 s (wait-far's pause at the near dock, then wait-near's) so it meets Chibi's arrival from
// chunk entry.
export const CRANE_FIXTURE_CHARACTERS: Readonly<Record<string, Character>> = {
  "test-crane-container": {
    archetype: "ledge",
    art: "freight-crane-container",
    behaviour: GANTRY_BEHAVIOUR,
    cols: 6,
    rows: 3,
  },
  "test-gantry-rail": {
    archetype: "scenery",
    art: "freight-gantry-rail",
    cols: 22,
    rows: 2,
  },
};

export const CRANE_FIXTURE_CATALOGUE = {
  archetypes: ARCHETYPES,
  characters: { ...CHARACTERS, ...CRANE_FIXTURE_CHARACTERS },
};

export const CRANE_FIXTURE = {
  dock: { col: 30, cols: 4 },
  far: { col: 56, cols: 4 },
  floor: 58,
  pit: { col: 34, cols: 22 },
  rail: -8,
  row: 50,
} as const;

const red = (col: number, cols: number, row: number): readonly Instance[] => [
  { character: "red-edge-top", col, cols, row: row - 1 },
  { character: "red-edge-support", col, cols, row, rows: ZONE_ROWS - row },
];

export const CRANE_FIXTURE_LIBRARY: ChunkLibrary = {
  ...FIXTURE_LIBRARY,
  characters: CRANE_FIXTURE_CATALOGUE.characters,
  chunks: {
    "test-crane": {
      cols: 60,
      difficulty: 4,
      encounters: 0,
      entry: { row: CRANE_FIXTURE.row },
      exit: { row: CRANE_FIXTURE.row },
      objects: [
        {
          backdropSpan: true,
          character: "test-gantry-rail",
          col: CRANE_FIXTURE.pit.col,
          row: CRANE_FIXTURE.row + CRANE_FIXTURE.rail - 2,
        },
        {
          behaviour: { ...GANTRY_BEHAVIOUR, initial: "wait-far" },
          character: "test-crane-container",
          col: CRANE_FIXTURE.pit.col,
          forcedTransit: GANTRY_RIDE_TRANSIT,
          row: CRANE_FIXTURE.row,
          tether: { art: "freight-crane-cable", row: CRANE_FIXTURE.rail },
        },
        ...red(CRANE_FIXTURE.pit.col, CRANE_FIXTURE.pit.cols, CRANE_FIXTURE.floor),
      ],
      solids: [
        ground(0, CRANE_FIXTURE.pit.col, CRANE_FIXTURE.row),
        ground(CRANE_FIXTURE.far.col, CRANE_FIXTURE.far.cols, CRANE_FIXTURE.row),
      ],
      theme: "test",
    },
  },
};

// The ravine gust engine's fixture, outside the shared fixture pool until its character reaches
// CHARACTERS with its art: a flat run (row 50) with a gust emitter against the far side of a
// 24-col band (cols 20 to 44, rows 46 to 50), blowing left against the route. It starts at its
// warning, so its first gust meets Chibi's arrival at the band from chunk entry. A second chunk
// mirrors the emitter to blow right from the near side.
export const GUST_FIXTURE_CHARACTERS: Readonly<Record<string, Character>> = {
  "test-gust-emitter": {
    archetype: "scenery",
    art: "woodland-gust-emitter",
    behaviour: GUST_BEHAVIOUR,
    cols: 1,
    rows: 4,
  },
};

export const GUST_FIXTURE_CATALOGUE = {
  archetypes: ARCHETYPES,
  characters: { ...CHARACTERS, ...GUST_FIXTURE_CHARACTERS },
};

export const GUST_FIXTURE = {
  band: { col: 20, cols: GUST_PULSE.range, row: 50 - GUST_PULSE.height, rows: GUST_PULSE.height },
  emitter: { col: 44, row: 46 },
  mirrored: { col: 15, row: 46 },
  row: 50,
} as const;

export const GUST_FIXTURE_LIBRARY: ChunkLibrary = {
  ...FIXTURE_LIBRARY,
  characters: GUST_FIXTURE_CATALOGUE.characters,
  chunks: {
    "test-gust": {
      cols: 60,
      difficulty: 4,
      encounters: 0,
      entry: { row: GUST_FIXTURE.row },
      exit: { row: GUST_FIXTURE.row },
      objects: [
        {
          behaviour: { ...GUST_BEHAVIOUR, initial: "warning" },
          character: "test-gust-emitter",
          ...GUST_FIXTURE.emitter,
        },
      ],
      solids: [ground(0, 60, GUST_FIXTURE.row)],
      theme: "test",
    },
    "test-gust-right": {
      cols: 60,
      difficulty: 4,
      encounters: 0,
      entry: { row: GUST_FIXTURE.row },
      exit: { row: GUST_FIXTURE.row },
      objects: [
        {
          behaviour: gustCycle(GUST_SECONDS, GUST_PULSE, 1, "warning"),
          character: "test-gust-emitter",
          ...GUST_FIXTURE.mirrored,
        },
      ],
      solids: [ground(0, 60, GUST_FIXTURE.row)],
      theme: "test",
    },
  },
};

// The windmill engine's fixture, outside the shared fixture pool until its characters reach
// CHARACTERS with their art: an approach run (row 50) to the first module's join, then a wheel of
// four sails turning against the clock over a trough (row 55) and an exit bank 10 rows up (row
// 40). The hub sits half a row below the exit bank's top, so the sail stopped on the rising side
// stands level and flush with it, and the sail stopped at the bottom 3 rows above the approach.
// The hub's footprint centres on the art's hub pixel (72, 72 in its 144x240 backdrop): 12 cols
// and 28 rows, the backdrop standing on its bottom edge.
export const WINDMILL_FIXTURE_CHARACTERS: Readonly<Record<string, Character>> = {
  "test-windmill": {
    archetype: "scenery",
    art: "countryside-windmill",
    cols: 12,
    rows: 28,
  },
  "test-windmill-sail": {
    archetype: "ledge",
    art: "windmill-sail-ledge",
    cols: 5,
    rows: 1,
  },
};

export const WINDMILL_FIXTURE_CATALOGUE = {
  archetypes: ARCHETYPES,
  characters: { ...CHARACTERS, ...WINDMILL_FIXTURE_CHARACTERS },
};

export const WINDMILL_FIXTURE = {
  approach: { col: 0, cols: 36, row: 50 },
  exit: { col: 55, cols: 5, row: 40 },
  hub: { col: 45.5, row: 40.5 },
  trough: { col: 36, cols: 19, row: 55 },
} as const;

const hub = WINDMILL_FIXTURE_CHARACTERS["test-windmill"]!;
const sail = WINDMILL_FIXTURE_CHARACTERS["test-windmill-sail"]!;

export const WINDMILL_FIXTURE_LIBRARY: ChunkLibrary = {
  ...FIXTURE_LIBRARY,
  characters: WINDMILL_FIXTURE_CATALOGUE.characters,
  chunks: {
    "test-windmill": {
      cols: 60,
      difficulty: 5,
      encounters: 0,
      entry: { row: WINDMILL_FIXTURE.approach.row },
      exit: { row: WINDMILL_FIXTURE.exit.row },
      noCross: [
        {
          from: { col: WINDMILL_FIXTURE.approach.cols - 2, row: WINDMILL_FIXTURE.approach.row },
          to: { col: WINDMILL_FIXTURE.exit.col + 2, row: WINDMILL_FIXTURE.exit.row },
        },
      ],
      objects: [
        {
          character: "test-windmill",
          col: WINDMILL_FIXTURE.hub.col - hub.cols / 2,
          id: "hub",
          row: WINDMILL_FIXTURE.hub.row - hub.rows / 2,
        },
        ...Array.from({ length: WINDMILL_SAILS.count }, (_, index): Instance => {
          const orbit = windmillSailOrbit("hub", index);
          return {
            character: "test-windmill-sail",
            col: WINDMILL_FIXTURE.hub.col + orbit.radius * Math.cos(orbit.phase) - sail.cols / 2,
            orbit,
            row: WINDMILL_FIXTURE.hub.row + orbit.radius * Math.sin(orbit.phase) - sail.rows / 2,
            tether: { art: "windmill-spoke" },
          };
        }),
      ],
      solids: [WINDMILL_FIXTURE.approach, WINDMILL_FIXTURE.trough, WINDMILL_FIXTURE.exit].map(
        ({ col, cols, row }) => ground(col, cols, row),
      ),
      theme: "test",
    },
  },
};

// The chandelier engine's fixture, outside the shared fixture pool until its characters reach
// CHARACTERS with their art: an observation module and near bank (row 50), then a chandelier
// swinging across a 22-col gap to a 4-col far bank on the same row. The mount's pivot sits 5 rows
// above the banks, so the rim holding at either end stands level and flush with that bank. Under
// the arc a floor 6 rows down (a jump) beneath the near half climbs back to the near bank, and one
// 2 rows lower (a hop) beneath the far half lies beyond a jump of the far bank, so the ride is
// required. The chandelier starts swinging back toward the near end, which it reaches in time for
// Chibi walking from the chunk's entry.
export const CHANDELIER_FIXTURE_CHARACTERS: Readonly<Record<string, Character>> = {
  "test-chandelier": {
    archetype: "ledge",
    art: "apartment-chandelier",
    cols: 6,
    rows: 2,
  },
  "test-chandelier-mount": {
    archetype: "scenery",
    art: "apartment-chandelier-mount",
    cols: 2,
    rows: 1,
  },
};

export const CHANDELIER_FIXTURE_CATALOGUE = {
  archetypes: ARCHETYPES,
  characters: { ...CHARACTERS, ...CHANDELIER_FIXTURE_CHARACTERS },
};

export const CHANDELIER_FIXTURE = {
  far: { col: 56, cols: 4, row: 50 },
  farFloor: { col: 45, cols: 11, row: 58 },
  near: { col: 0, cols: 34, row: 50 },
  nearFloor: { col: 34, cols: 11, row: 56 },
  phase: 0.875,
  pivot: { col: 45, row: 45 },
} as const;

const chandelier = CHANDELIER_FIXTURE_CHARACTERS["test-chandelier"]!;
const mount = CHANDELIER_FIXTURE_CHARACTERS["test-chandelier-mount"]!;
const chandelierPath = chandelierOrbit("mount", CHANDELIER_FIXTURE.phase);
const chandelierStart = pendulumAngle(0, chandelierPath);

export const CHANDELIER_FIXTURE_LIBRARY: ChunkLibrary = {
  ...FIXTURE_LIBRARY,
  characters: CHANDELIER_FIXTURE_CATALOGUE.characters,
  chunks: {
    "test-chandelier": {
      cols: 60,
      difficulty: 5,
      encounters: 0,
      entry: { row: CHANDELIER_FIXTURE.near.row },
      exit: { row: CHANDELIER_FIXTURE.far.row },
      noCross: [
        {
          from: { col: CHANDELIER_FIXTURE.near.cols - 2, row: CHANDELIER_FIXTURE.near.row },
          to: { col: CHANDELIER_FIXTURE.far.col + 2, row: CHANDELIER_FIXTURE.far.row },
        },
      ],
      objects: [
        {
          character: "test-chandelier-mount",
          col: CHANDELIER_FIXTURE.pivot.col - mount.cols / 2,
          id: "mount",
          row: CHANDELIER_FIXTURE.pivot.row - mount.rows / 2,
        },
        {
          character: "test-chandelier",
          col:
            CHANDELIER_FIXTURE.pivot.col +
            CHANDELIER_SWING.length * Math.sin(chandelierStart) -
            chandelier.cols / 2,
          orbit: chandelierPath,
          row:
            CHANDELIER_FIXTURE.pivot.row +
            CHANDELIER_SWING.length * Math.cos(chandelierStart) -
            chandelier.rows / 2,
          tether: { art: "apartment-chandelier-chain" },
        },
      ],
      solids: [
        CHANDELIER_FIXTURE.near,
        CHANDELIER_FIXTURE.nearFloor,
        CHANDELIER_FIXTURE.farFloor,
        CHANDELIER_FIXTURE.far,
      ].map(({ col, cols, row }) => ground(col, cols, row)),
      theme: "test",
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
  ...Object.entries(STAGE_RECIPES).map(([key, recipe]) => [key, CHUNK_LIBRARY, recipe] as const),
];
