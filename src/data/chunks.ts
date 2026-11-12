import { outdoorBackground } from "./backgrounds.ts";
import {
  CITY_GROUND_HAZARD_BEHAVIOUR,
  CITY_LIFT_BEHAVIOUR,
  CITY_SHUTTLE_BEHAVIOUR,
} from "./behaviours.ts";
import {
  BOUNDARY_START,
  CHUNK_COLS,
  PATROL_ENCOUNTER,
  redCeiling,
  withoutEncounters,
} from "./chunkTemplates.ts";
import { OUTDOOR_LIFT_ASCENT_TRANSIT } from "./forcedTransit.ts";
import { createHazardChunks } from "./hazardChunks.ts";
import { CRUMBLING_SUPPORT_TUNING } from "./obstacleTuning.ts";
import { createOrbitHazardChunks } from "./orbitHazardChunks.ts";
import { SCREEN, TILE, ZONE_ROWS } from "./screen.ts";
import type {
  ChunkPlan,
  ChunkPool,
  ChunkRules,
  ElementBinding,
  Instance,
  TerrainRect,
  ThemePlan,
} from "./types/index.ts";
import { withValleyFloors } from "./valleyFloors.ts";
import { WOODLAND_SCENERY, woodlandDepth, woodlandSpecies } from "./woodlandScenery.ts";
import { STREET_CHUNKS } from "./zone1.ts";
import { INDUSTRIAL_CHUNKS } from "./zone2.ts";
import { COUNTRYSIDE_CHUNKS } from "./zone3.ts";
import { WOODLAND_CHUNKS } from "./zone4.ts";
import { HOME_CITY_CHUNKS } from "./zone5.ts";
import { APARTMENT_CHUNKS, createApartmentMiddleChunks } from "./zone6.ts";

export const CHUNK_RULES: ChunkRules = {
  cols: { max: CHUNK_COLS, min: CHUNK_COLS },
  footing: 4,
  headroom: 6,
};

const APARTMENT_THEMES = [
  "apartment-entrance",
  "apartment-exterior",
  "apartment-lobby",
  "apartment-pool",
  "apartment-residential",
  "apartment-restaurant",
  "apartment-spa",
];

const MECHANICAL_THEMES = [
  "back-streets",
  "city-streets",
  "country-lanes",
  "deep-woods",
  "loading-yards",
  ...APARTMENT_THEMES,
  "city-boundary",
  "city-outskirts",
  "familiar-neighbourhood",
  "farmland",
  "forest-paths",
  "freight-terminal",
  "ravine",
  "river-crossing",
  "street",
  "warehouse-district",
];

const COMMON_BINDINGS: Readonly<Record<string, ElementBinding>> = {
  "edge-bottom": { character: "red-edge-bottom" },
  "edge-left": { character: "red-edge-left" },
  "edge-right": { character: "red-edge-right" },
  "edge-top": { character: "red-edge-top" },
  ledge: { character: "platform-ledge" },
  lift: { character: "city-lift" },
  "moving-hazard": { character: "city-ground-hazard" },
  shuttle: { character: "city-shuttle" },
  support: { character: "red-edge-support" },
};

const CITY_THEME: ThemePlan = {
  backdrops: [{ character: "street-sky", parallax: { x: 1, y: 1 }, role: "sky", row: 0 }],
  background: outdoorBackground(false),
  bindings: {
    ...COMMON_BINDINGS,
    antagonist: { character: "dog-antagonist", scene: null },
    "antagonist-intro": {
      character: "dog-antagonist",
      scene: null,
    },
    "boundary-wall": { character: "facade-one-storey" },
    canopy: { character: "canopy" },
    "depot-wall": { character: "depot-wall" },
    door: { character: "street-door" },
    "far-background": { character: "street-city-far" },
    "fire-escape-railing": { character: "fire-escape-railing" },
    "loading-bay": { character: "depot-loading-bay" },
    "mid-background": { character: "street-city-mid" },
    "near-wall": { character: "facade-one-storey" },
    parcel: { character: "parcel-open" },
    roofline: { character: "roofline-brownstone" },
    signal: { character: "walk-signal" },
    sky: { character: "street-sky" },
    storefront: { character: "storefront-noodle-bar" },
    "tall-wall": { character: "facade-brownstone" },
  },
  door: "door",
  looks: { ground: "sidewalk", raised: "sidewalk" },
  tileset: "tiles-street",
};

const INDUSTRIAL_BINDINGS: Readonly<Record<string, ElementBinding>> = {
  ...COMMON_BINDINGS,
  antagonist: { character: "pigeon-antagonist", scene: null },
  "antagonist-intro": {
    character: "pigeon-antagonist",
    scene: null,
  },
  "boundary-wall": {
    character: "facade-one-storey",
    skin: { art: "warehouse-wall", tileset: null },
  },
  door: { character: "street-door", skin: { art: "door", tileset: "tiles-street" } },
  "far-background": {
    character: "street-city-far",
    skin: { art: "industrial-far", tileset: null },
  },
  "loading-bay": {
    character: "depot-loading-bay",
    skin: { art: "warehouse-loading-bay", tileset: null },
  },
  "mid-background": {
    character: "street-city-mid",
    skin: { art: "warehouse-mid", tileset: null },
  },
  "near-wall": {
    character: "facade-one-storey",
    skin: { art: "warehouse-wall", tileset: null },
  },
  sky: { character: "street-sky", skin: { art: "industrial-sky", tileset: null } },
  "tunnel-wall": {
    character: "apartment-wall-panel",
    skin: { art: "warehouse-wall", tileset: null },
  },
};

const COMMON_BACKDROPS: ThemePlan["backdrops"] = CITY_THEME.backdrops;

export function localDepth(row: number): readonly Instance[] {
  return [
    {
      character: "street-sky",
      col: 0,
      cols: CHUNK_COLS,
      parallax: { x: 0, y: 0 },
      role: "sky",
      row,
    },
    {
      character: "street-city-far",
      col: 0,
      cols: CHUNK_COLS,
      parallax: { x: 0.15, y: 0.05 },
      role: "far-background",
      row,
    },
    {
      character: "street-city-mid",
      col: 0,
      cols: CHUNK_COLS,
      parallax: { x: 0.4, y: 0.15 },
      role: "mid-background",
      row,
    },
  ];
}

const COUNTRYSIDE_BINDINGS: Readonly<Record<string, ElementBinding>> = {
  ...COMMON_BINDINGS,
  antagonist: { character: "goose-antagonist", scene: null },
  "antagonist-intro": {
    character: "goose-antagonist",
    scene: null,
  },
  door: { character: "street-door", skin: { art: "door", tileset: "tiles-street" } },
  "far-background": {
    character: "street-city-far",
    skin: { art: "countryside-far", tileset: null },
  },
  "loading-bay": { character: "depot-loading-bay", skin: { art: "farmland-barn", tileset: null } },
  "mid-background": { character: "street-city-mid", skin: { art: "farmland-mid", tileset: null } },
  "near-wall": { character: "facade-one-storey", skin: { art: "farmland-fence", tileset: null } },
  sky: { character: "street-sky", skin: { art: "countryside-sky", tileset: null } },
};

const WOODLAND_BINDINGS: Readonly<Record<string, ElementBinding>> = {
  ...COMMON_BINDINGS,
  antagonist: { character: "bear-antagonist", scene: null },
  "antagonist-intro": { character: "bear-antagonist", scene: null },
  "boundary-wall": { character: "facade-one-storey", skin: { art: "forest-shrub", tileset: null } },
  door: { character: "street-door", skin: { art: "door", tileset: "tiles-street" } },
  "far-background": { character: "street-city-far", skin: { art: "woodland-far", tileset: null } },
  "loading-bay": { character: "depot-loading-bay", skin: { art: "forest-tree", tileset: null } },
  "mid-background": { character: "street-city-mid", skin: { art: "forest-mid", tileset: null } },
  "near-wall": { character: "facade-one-storey", skin: { art: "forest-tree", tileset: null } },
  sky: { character: "street-sky", skin: { art: "woodland-sky", tileset: null } },
};

const HOME_CITY_BINDINGS: Readonly<Record<string, ElementBinding>> = {
  ...COMMON_BINDINGS,
  antagonist: { character: "raccoon-antagonist", scene: null },
  "antagonist-intro": {
    character: "raccoon-antagonist",
    scene: null,
  },
  "boundary-wall": {
    character: "facade-one-storey",
    skin: { art: "outskirts-wall", tileset: null },
  },
  door: { character: "street-door", skin: { art: "door", tileset: "tiles-street" } },
  "far-background": { character: "street-city-far", skin: { art: "homecity-far", tileset: null } },
  "loading-bay": {
    character: "depot-loading-bay",
    skin: { art: "homecity-awning", tileset: null },
  },
  "mid-background": { character: "street-city-mid", skin: { art: "outskirts-mid", tileset: null } },
  "near-wall": { character: "facade-one-storey", skin: { art: "outskirts-wall", tileset: null } },
  sky: { character: "street-sky", skin: { art: "homecity-sky", tileset: null } },
};

function apartmentTheme(
  wall: string | null,
  ground: string,
  raised: string,
  prop: string,
): ThemePlan {
  return {
    backdrops:
      wall === null
        ? [{ character: "street-sky", parallax: { x: 1, y: 1 }, role: "sky", row: 10 }]
        : [],
    bindings: {
      ...COMMON_BINDINGS,
      antagonist: { character: "ferret-antagonist", scene: null },
      "antagonist-intro": {
        character: "ferret-antagonist",
        scene: null,
      },
      door: {
        character: "apartment-room-door",
        skin: { art: "apartment-room-door", tileset: null },
      },
      "far-background": {
        character: "street-city-far",
        skin: { art: "apartment-far", tileset: null },
      },
      "final-goal": {
        character: "apartment-stairwell",
        skin: {
          art:
            wall === "apartment-wall-residential"
              ? "apartment-stairwell-door"
              : "apartment-stairwell",
          tileset: null,
        },
      },
      "mid-background": {
        character: "street-city-mid",
        skin: { art: "apartment-exterior-mid", tileset: null },
      },
      "near-wall": { character: "facade-one-storey", skin: { art: prop, tileset: null } },
      sky: { character: "street-sky", skin: { art: "apartment-sky", tileset: null } },
      "transition-down": {
        character: "apartment-stairwell",
        skin: { art: "apartment-stairwell-down", tileset: null },
      },
      "transition-up": { character: "apartment-stairwell" },
      wall: {
        character: "apartment-wall-panel",
        skin: { art: wall ?? "apartment-facade", tileset: null },
      },
    },
    door: "door",
    looks: { ground, raised },
    tileset: "tiles-apartment",
  };
}

// The themes chunks are drawn in, by key.
export const THEMES: Readonly<Record<string, ThemePlan>> = {
  "apartment-entrance": apartmentTheme(
    null,
    "apartment-stone",
    "apartment-brick",
    "apartment-facade",
  ),
  "apartment-exterior": apartmentTheme(
    null,
    "apartment-metal",
    "apartment-brick",
    "apartment-facade",
  ),
  "apartment-lobby": apartmentTheme(
    "apartment-wall-lobby",
    "apartment-wood",
    "apartment-plaster",
    "apartment-lobby-sofa",
  ),
  "apartment-penthouse": apartmentTheme(
    "apartment-wall-residential",
    "apartment-wood",
    "apartment-stone",
    "apartment-lobby-sofa",
  ),
  "apartment-pool": apartmentTheme(
    "apartment-wall-pool",
    "apartment-tile",
    "apartment-stone",
    "apartment-pool-water",
  ),
  "apartment-residential": apartmentTheme(
    "apartment-wall-residential",
    "apartment-wood",
    "apartment-plaster",
    "apartment-residential-shelf",
  ),
  "apartment-restaurant": apartmentTheme(
    "apartment-wall-restaurant",
    "apartment-wood",
    "apartment-tile",
    "apartment-restaurant-counter",
  ),
  "apartment-spa": apartmentTheme(
    "apartment-wall-spa",
    "apartment-tile",
    "apartment-plaster",
    "apartment-spa-screen",
  ),
  "back-streets": {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(false),
    bindings: {
      ...HOME_CITY_BINDINGS,
      "near-wall": {
        character: "facade-one-storey",
        skin: { art: "neighbourhood-wall", tileset: null },
      },
    },
    door: "door",
    looks: { ground: "outskirts-ground", raised: "brick-stack" },
    tileset: "tiles-homecity",
  },
  "city-boundary": {
    ...CITY_THEME,
    bindings: {
      ...CITY_THEME.bindings,
      "mid-background": {
        character: "street-city-mid",
        skin: { art: "street-boundary-mid", tileset: null },
      },
    },
  },
  "city-outskirts": {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(false),
    bindings: HOME_CITY_BINDINGS,
    door: "door",
    looks: { ground: "outskirts-ground", raised: "brick-stack" },
    tileset: "tiles-homecity",
  },
  "city-streets": CITY_THEME,
  "country-lanes": {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(false),
    bindings: {
      ...COUNTRYSIDE_BINDINGS,
      "loading-bay": {
        character: "depot-loading-bay",
        skin: { art: "farmland-fence", tileset: null },
      },
    },
    door: "door",
    looks: { ground: "country-ground", raised: "hay-stack" },
    tileset: "tiles-countryside",
  },
  "deep-woods": {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(true),
    bindings: { ...WOODLAND_BINDINGS, ...woodlandSpecies("woodland-far", "forest-mid-conifers") },
    door: "door",
    looks: { ground: "forest-ground", raised: "root-stack" },
    tileset: "tiles-woodland",
  },
  "familiar-neighbourhood": {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(false),
    bindings: {
      ...HOME_CITY_BINDINGS,
      "boundary-wall": {
        character: "facade-one-storey",
        skin: { art: "neighbourhood-wall", tileset: null },
      },
      "mid-background": {
        character: "street-city-mid",
        skin: { art: "neighbourhood-mid", tileset: null },
      },
      "near-wall": {
        character: "facade-one-storey",
        skin: { art: "neighbourhood-wall", tileset: null },
      },
    },
    door: "door",
    looks: { ground: "neighbourhood-ground", raised: "stoop-stack" },
    tileset: "tiles-homecity",
  },
  farmland: {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(false),
    bindings: COUNTRYSIDE_BINDINGS,
    door: "door",
    looks: { ground: "country-ground", raised: "hay-stack" },
    tileset: "tiles-countryside",
  },
  "forest-paths": {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(true),
    bindings: { ...WOODLAND_BINDINGS, ...woodlandSpecies("woodland-far", "forest-mid-birch") },
    door: "door",
    looks: { ground: "forest-ground", raised: "root-stack" },
    tileset: "tiles-woodland",
  },
  "freight-terminal": {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(false),
    bindings: {
      ...INDUSTRIAL_BINDINGS,
      "boundary-wall": {
        character: "facade-one-storey",
        skin: { art: "freight-gantry", tileset: null },
      },
      "loading-bay": {
        character: "depot-loading-bay",
        skin: { art: "freight-gantry", tileset: null },
      },
      "mid-background": {
        character: "street-city-mid",
        skin: { art: "freight-mid", tileset: null },
      },
      "near-wall": {
        character: "facade-one-storey",
        skin: { art: "freight-gantry", tileset: null },
      },
    },
    door: "door",
    looks: { ground: "terminal-floor", raised: "container-stack" },
    tileset: "tiles-industrial",
  },
  "loading-yards": {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(false),
    bindings: {
      ...INDUSTRIAL_BINDINGS,
      "loading-bay": {
        character: "depot-loading-bay",
        skin: { art: "freight-gantry", tileset: null },
      },
    },
    door: "door",
    looks: { ground: "industrial-floor", raised: "crate-stack" },
    tileset: "tiles-industrial",
  },
  // The park, outdoors in autumn. Chunks name two looks, ground (the lawn, its top at row 50)
  // and raised (the terraces above it), both drawn as art's grass top over turf over soil. Its
  // backdrops, back to front: the sky, the clouds, the city, the far trees and the treetops,
  // each standing where art puts its bottom edge.
  park: {
    backdrops: [
      { character: "park-sky", parallax: { x: 0, y: 0 }, role: "sky", row: 0 },
      { character: "park-clouds", role: "clouds", row: 3 },
      { character: "park-city", parallax: { x: 0.15, y: 0.05 }, role: "far-background", row: 28 },
      { character: "park-far-trees", role: "distant-trees", row: 40 },
      {
        character: "park-treetops",
        parallax: { x: 0.4, y: 0.15 },
        role: "mid-background",
        row: 15,
      },
    ],
    bindings: {
      ...COMMON_BINDINGS,
      bandstand: { character: "park-bandstand" },
      bench: { character: "park-bench" },
      "bench-frame": { character: "park-bench-frame" },
      branch: { character: "park-branch" },
      clouds: { character: "park-clouds" },
      "distant-trees": { character: "park-far-trees" },
      door: { character: "park-gate" },
      "far-background": { character: "park-city" },
      lamp: { character: "park-lamp" },
      "mid-background": { character: "park-treetops" },
      "roof-ledge": { character: "park-bandstand-roof" },
      shuttle: { character: "park-boat" },
      sky: { character: "park-sky" },
      tree: { character: "park-tree" },
    },
    door: "door",
    looks: { ground: "grass", raised: "grass" },
    tileset: "tiles-park",
  },
  ravine: {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(true),
    bindings: {
      ...WOODLAND_BINDINGS,
      ...woodlandSpecies("woodland-far-conifers", "forest-mid-birch"),
      "boundary-wall": {
        character: "facade-one-storey",
        skin: { art: "ravine-rock", tileset: null },
      },
      "loading-bay": {
        character: "depot-loading-bay",
        skin: { art: "ravine-rock", tileset: null },
      },
      "mid-background": {
        character: "street-city-mid",
        skin: { art: "ravine-mid", tileset: null },
      },
      "near-wall": { character: "facade-one-storey", skin: { art: "ravine-rock", tileset: null } },
    },
    door: "door",
    looks: { ground: "ravine-ground", raised: "stone-stack" },
    tileset: "tiles-woodland",
  },
  "river-crossing": {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(false),
    bindings: {
      ...COUNTRYSIDE_BINDINGS,
      "loading-bay": {
        character: "depot-loading-bay",
        skin: { art: "river-reeds", tileset: null },
      },
      "mid-background": { character: "street-city-mid", skin: { art: "river-mid", tileset: null } },
      "near-wall": { character: "facade-one-storey", skin: { art: "river-reeds", tileset: null } },
    },
    door: "door",
    looks: { ground: "riverbank", raised: "timber-crossing" },
    tileset: "tiles-countryside",
  },
  street: CITY_THEME,
  "warehouse-district": {
    backdrops: COMMON_BACKDROPS,
    background: outdoorBackground(false),
    bindings: INDUSTRIAL_BINDINGS,
    door: "door",
    looks: { ground: "industrial-floor", raised: "crate-stack" },
    tileset: "tiles-industrial",
  },
};

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: row === 50 ? "ground" : "raised",
  row,
  rows: ZONE_ROWS - row,
});
const ledge = (col: number, cols: number, row: number): Instance => ({
  character: "platform-ledge",
  col,
  cols,
  role: "ledge",
  row,
});
const lift = (col: number, row: number): Instance => ({
  character: "city-lift",
  col,
  role: "lift",
  row,
});
const shuttle = (col: number, row: number, distance: number): Instance => ({
  behaviour: { ...CITY_SHUTTLE_BEHAVIOUR, distance },
  character: "city-shuttle",
  col,
  role: "shuttle",
  row,
});
const mover = (col: number, row: number): Instance => ({
  character: "city-ground-hazard",
  col,
  role: "moving-hazard",
  row,
});
const red = (col: number, cols: number, row: number): readonly Instance[] => [
  { character: "red-edge-top", col, cols, role: "edge-top", row: row - 1 },
  { character: "red-edge-support", col, cols, role: "support", row, rows: ZONE_ROWS - row },
];
function moduleChunk(
  theme: ChunkPlan["theme"],
  difficulty: ChunkPlan["difficulty"],
  entry: ChunkPlan["entry"]["row"],
  exit: ChunkPlan["exit"]["row"],
  solids: readonly TerrainRect[],
  objects: readonly Instance[] = [],
): ChunkPlan {
  return {
    cols: CHUNK_COLS,
    difficulty,
    encounters: objects.some(({ role }) => role === "antagonist") ? 1 : 0,
    entry: { row: entry },
    exit: { row: exit },
    objects,
    solids,
    theme,
  };
}
function shifted(offset: number, chunk: Omit<ChunkPlan, "theme">): Omit<ChunkPlan, "theme"> {
  return {
    ...chunk,
    entry: { row: (chunk.entry.row + offset) as ChunkPlan["entry"]["row"] },
    exit: { row: (chunk.exit.row + offset) as ChunkPlan["exit"]["row"] },
    objects: chunk.objects.map((object) => ({
      ...object,
      row: object.row + offset,
      ...(object.rows !== undefined && object.row + object.rows === ZONE_ROWS
        ? { rows: object.rows - offset }
        : {}),
    })),
    solids: chunk.solids.map((solid) => floor(solid.col, solid.cols, solid.row + offset)),
  };
}
const COMPACT_ASCENT = moduleChunk(
  MECHANICAL_THEMES,
  4,
  50,
  40,
  [floor(0, 8, 50), floor(8, 4, 47), floor(12, 24, 50), floor(36, 6, 45), floor(42, 18, 40)],
  [ledge(12, 6, 44), mover(18, 49), ledge(32, 6, 44)],
);
const TAP_TERRAIN = [
  floor(0, 8, 50),
  floor(8, 10, 47),
  floor(18, 4, 46),
  floor(22, 32, 47),
  floor(54, 6, 50),
];
const RETURN_HIGH = [
  floor(0, 8, 30),
  floor(8, 8, 35),
  floor(16, 8, 40),
  floor(24, 8, 45),
  floor(32, 28, 50),
];
const RETURN_TERRACE = [
  floor(0, 12, 40),
  floor(12, 12, 45),
  floor(24, 20, 50),
  floor(44, 4, 47),
  floor(48, 12, 50),
];
const PARK_UP = moduleChunk(
  "park",
  2,
  50,
  40,
  [
    floor(0, 12, 50),
    floor(16, 8, 50),
    floor(24, 8, 45),
    floor(32, 12, 40),
    floor(44, 4, 37),
    floor(48, 12, 40),
  ],
  red(12, 4, 50),
);
const MESA_TERRAIN = [
  floor(0, 10, 50),
  floor(10, 10, 46),
  floor(20, 20, 42),
  floor(40, 10, 46),
  floor(50, 10, 50),
];
const CENTRAL_CROSSING_TERRAIN = [floor(0, 24, 50), floor(24, 12, 46), floor(36, 24, 50)];
const CENTRAL_CROSSING_REFUGES = [ledge(10, 12, 42), ledge(38, 12, 42)];
const CONNECTED_TERRAIN_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "broad-mesa": moduleChunk(MECHANICAL_THEMES, 4, 50, 50, MESA_TERRAIN),
  "low-central-crossing": moduleChunk(
    MECHANICAL_THEMES,
    4,
    50,
    50,
    CENTRAL_CROSSING_TERRAIN,
    CENTRAL_CROSSING_REFUGES,
  ),
};

const AUTHORED_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  ...createHazardChunks(MECHANICAL_THEMES),
  ...createOrbitHazardChunks(MECHANICAL_THEMES),
  ...CONNECTED_TERRAIN_CHUNKS,
  "city-boundary-edge-yard": moduleChunk(
    MECHANICAL_THEMES,
    3,
    50,
    40,
    [
      floor(0, 12, 50),
      floor(16, 4, 50),
      floor(20, 4, 47),
      floor(24, 4, 50),
      floor(28, 4, 44),
      floor(32, 8, 47),
      floor(40, 4, 45),
      floor(44, 4, 44),
      floor(48, 12, 40),
    ],
    [
      ...red(12, 4, 50),
      { character: "red-edge-left", col: 27, role: "edge-left", row: 44, rows: 6 },
    ],
  ),
  "city-boundary-finish": { ...withoutEncounters(PATROL_ENCOUNTER), theme: "city-boundary" },
  "city-boundary-gaps": moduleChunk(
    MECHANICAL_THEMES,
    3,
    50,
    40,
    [floor(0, 8, 50), floor(16, 8, 50), floor(36, 4, 50), floor(40, 4, 45), floor(44, 16, 40)],
    [...red(8, 8, 55), ...red(24, 12, 55)],
  ),
  "city-boundary-ground-hazard": moduleChunk(
    MECHANICAL_THEMES,
    4,
    40,
    40,
    [floor(0, 12, 40), floor(12, 4, 37), floor(16, 28, 40), floor(44, 4, 37), floor(48, 12, 40)],
    [ledge(18, 6, 34), mover(24, 39), ledge(38, 4, 34), ...redCeiling(42, 8, 33)],
  ),
  "city-boundary-jumps": moduleChunk(
    MECHANICAL_THEMES,
    3,
    50,
    40,
    [
      floor(0, 8, 50),
      floor(8, 4, 44),
      floor(12, 12, 48),
      floor(24, 4, 44),
      floor(28, 8, 47),
      floor(36, 4, 43),
      floor(40, 8, 40),
      floor(48, 4, 37),
      floor(52, 8, 40),
    ],
    [],
  ),
  "city-boundary-lift": moduleChunk(
    MECHANICAL_THEMES,
    3,
    40,
    30,
    [floor(0, 12, 40), floor(28, 16, 30), floor(44, 4, 27), floor(48, 12, 30)],
    [lift(14, 40), ...red(12, 16, 47)],
  ),
  "city-boundary-low-ceiling": moduleChunk(
    MECHANICAL_THEMES,
    3,
    50,
    40,
    [floor(0, 22, 50), floor(22, 4, 49), floor(26, 10, 50), floor(36, 8, 45), floor(44, 16, 40)],
    redCeiling(16, 14, 42),
  ),
  "city-boundary-return-gap": moduleChunk(
    MECHANICAL_THEMES,
    3,
    30,
    50,
    [
      floor(0, 12, 30),
      floor(12, 4, 35),
      floor(28, 8, 35),
      floor(36, 6, 40),
      floor(42, 6, 45),
      floor(48, 12, 50),
    ],
    red(16, 12, 45),
  ),
  "city-boundary-return-high": moduleChunk(MECHANICAL_THEMES, 2, 30, 50, RETURN_HIGH, []),
  "city-boundary-return-terrace": moduleChunk(MECHANICAL_THEMES, 2, 40, 50, RETURN_TERRACE, []),
  "city-boundary-shuttle": moduleChunk(
    MECHANICAL_THEMES,
    3,
    40,
    40,
    [floor(0, 8, 40), floor(30, CHUNK_COLS - 30, 40)],
    [shuttle(10, 40, 14), ...red(8, 22, 47)],
  ),
  "city-boundary-start": { ...BOUNDARY_START, theme: "city-boundary" },
  "city-boundary-steps": moduleChunk(
    MECHANICAL_THEMES,
    3,
    50,
    40,
    [
      floor(0, 8, 50),
      floor(8, 6, 45),
      floor(14, 6, 40),
      floor(20, 6, 35),
      floor(26, 14, 30),
      floor(40, 8, 35),
      floor(48, 12, 40),
    ],
    [],
  ),
  "city-boundary-upper-climb": moduleChunk(
    MECHANICAL_THEMES,
    3,
    40,
    30,
    [
      floor(0, 12, 40),
      floor(12, 8, 35),
      floor(20, 12, 30),
      floor(32, 4, 27),
      floor(36, 8, 30),
      floor(44, 4, 27),
      floor(48, 12, 30),
    ],
    [],
  ),
  "compound-ascent": moduleChunk(
    MECHANICAL_THEMES,
    4,
    50,
    40,
    [
      floor(0, 8, 50),
      floor(16, 4, 50),
      floor(20, 4, 47),
      floor(24, 4, 50),
      floor(28, 4, 44),
      floor(32, 8, 45),
      floor(40, 20, 40),
    ],
    [
      ...red(8, 8, 55),
      { character: "red-edge-left", col: 27, role: "edge-left", row: 44, rows: 6 },
    ],
  ),
  "compound-compact-ascent": COMPACT_ASCENT,
  "compound-compact-climb": { ...shifted(-10, COMPACT_ASCENT), theme: MECHANICAL_THEMES },
  "compound-double-lift": moduleChunk(
    MECHANICAL_THEMES,
    5,
    40,
    30,
    [floor(0, 8, 40), floor(22, 6, 30), floor(48, 12, 30)],
    [lift(10, 40), lift(34, 30), ...red(8, 40, 50)],
  ),
  "compound-lift-shuttle": moduleChunk(
    MECHANICAL_THEMES,
    5,
    50,
    30,
    [floor(0, 8, 50), floor(22, 10, 40), floor(54, CHUNK_COLS - 54, 30)],
    [lift(10, 50), shuttle(32, 36, 16), ...red(8, 46, 57)],
  ),
  "compound-low-ceiling-hazard": moduleChunk(MECHANICAL_THEMES, 4, 50, 50, TAP_TERRAIN, [
    ...redCeiling(12, 16, 40),
    ledge(28, 4, 41),
    mover(32, 46),
    ledge(48, 6, 41),
  ]),
  "compound-low-ceiling-shuttle": moduleChunk(
    MECHANICAL_THEMES,
    5,
    50,
    50,
    [
      floor(0, 4, 50),
      floor(4, 4, 47),
      floor(8, 4, 46),
      floor(12, 6, 47),
      floor(40, 8, 47),
      floor(48, CHUNK_COLS - 48, 50),
    ],
    [...redCeiling(5, 12, 40), shuttle(18, 47, 16), ...red(18, 22, 57)],
  ),
  "compound-return-high": moduleChunk(
    MECHANICAL_THEMES,
    5,
    30,
    50,
    [floor(0, 8, 30), floor(8, 8, 35), floor(24, 4, 40), floor(28, 4, 45), floor(32, 28, 50)],
    [...red(16, 8, 47), ledge(32, 4, 44), mover(36, 49), ledge(50, 6, 44)],
  ),
  "compound-return-shuttle": moduleChunk(
    MECHANICAL_THEMES,
    4,
    30,
    50,
    [
      floor(0, 8, 30),
      floor(8, 8, 35),
      floor(16, 4, 40),
      floor(42, 6, 40),
      floor(48, 6, 45),
      floor(54, CHUNK_COLS - 54, 50),
    ],
    [shuttle(22, 40, 14), ...red(20, 22, 54)],
  ),
  "compound-return-terrace": moduleChunk(
    MECHANICAL_THEMES,
    4,
    40,
    50,
    [floor(0, 36, 40), floor(36, 8, 45), floor(44, 4, 50), floor(52, 8, 50)],
    [ledge(8, 6, 34), mover(16, 39), ledge(30, 6, 34), ...red(48, 4, 50)],
  ),
  "compound-transfer-gate": moduleChunk(
    MECHANICAL_THEMES,
    5,
    50,
    50,
    [floor(0, 4, 50), floor(24, 8, 50), floor(52, 8, 50)],
    [
      shuttle(4, 50, 14),
      ledge(4, 4, 54),
      {
        behaviour: { ...CITY_GROUND_HAZARD_BEHAVIOUR, axis: "y", distance: -10, initial: "back" },
        character: "red-edge-left",
        col: 28,
        role: "edge-left",
        row: 44,
        rows: 6,
      },
      shuttle(32, 50, 14),
      ledge(32, 4, 54),
      ...red(4, 20, 58),
      ...red(32, 20, 58),
    ],
  ),
  "crumbling-support-crossing": moduleChunk(
    MECHANICAL_THEMES,
    4,
    50,
    50,
    [floor(0, 12, 50), floor(12, 30, 58), floor(42, 18, 50)],
    [{ ...ledge(24, 6, 48), crumbling: CRUMBLING_SUPPORT_TUNING }, ...red(12, 30, 58)],
  ),
  "park-bandstand": moduleChunk(
    "park",
    2,
    50,
    30,
    [
      floor(0, 8, 50),
      floor(8, 8, 47),
      floor(16, 8, 44),
      floor(24, 8, 40),
      floor(32, 8, 36),
      floor(40, 8, 33),
      floor(48, 12, 30),
    ],
    [{ character: "park-bandstand-roof", col: 24, role: "roof-ledge", row: 34 }],
  ),
  "park-finish": moduleChunk(
    "park",
    1,
    50,
    50,
    [floor(0, 28, 50), floor(28, 4, 47), floor(32, 28, 50)],
    [],
  ),
  "park-high-walk": moduleChunk(
    "park",
    3,
    30,
    30,
    [floor(0, 8, 30), floor(20, 8, 30), floor(40, 8, 30), floor(48, 4, 27), floor(52, 8, 30)],
    [...red(8, 12, 35), ...red(28, 12, 35)],
  ),
  "park-lawn": {
    ...moduleChunk(
      "park",
      1,
      50,
      50,
      [
        floor(0, 12, 50),
        floor(12, 4, 47),
        floor(16, 8, 50),
        floor(24, 4, 47),
        floor(28, 12, 50),
        floor(40, 4, 47),
        floor(44, 16, 50),
      ],
      [],
    ),
    slots: [{ area: { col: 50, cols: 4, row: 45, rows: 5 }, id: "by-the-tree", kind: "door" }],
  },
  "park-low-ceiling": moduleChunk(
    "park",
    3,
    50,
    50,
    [floor(0, 26, 50), floor(26, 4, 49), floor(30, 14, 50), floor(44, 4, 47), floor(48, 12, 50)],
    redCeiling(20, 18, 41),
  ),
  "park-pond": {
    ...moduleChunk(
      "park",
      3,
      40,
      40,
      [floor(0, 8, 40), floor(46, 14, 40)],
      [...red(8, 38, 46), { character: "park-boat", col: 10, phase: 0, role: "shuttle", row: 40 }],
    ),
    noCross: [{ from: { col: 4, row: 40 }, to: { col: 52, row: 40 } }],
    slots: [{ area: { col: 50, cols: 4, row: 35, rows: 5 }, id: "far-bank", kind: "door" }],
  },
  "park-slope-down": moduleChunk(
    "park",
    2,
    30,
    50,
    [
      floor(0, 8, 30),
      floor(8, 8, 36),
      floor(16, 8, 42),
      floor(24, 8, 46),
      floor(32, 12, 50),
      floor(48, 12, 50),
    ],
    red(44, 4, 50),
  ),
  "park-start": {
    ...moduleChunk(
      "park",
      1,
      50,
      50,
      [floor(0, 20, 50), floor(20, 4, 47), floor(24, 16, 50), floor(40, 4, 47), floor(44, 16, 50)],
      [],
    ),
    slots: [{ area: { col: 48, cols: 6, row: 44, rows: 6 }, id: "lawn", kind: "event" }],
  },
  "park-steps-down": moduleChunk(
    "park",
    2,
    30,
    40,
    [floor(0, 8, 30), floor(8, 8, 35), floor(16, 8, 40), floor(28, 16, 40), floor(48, 12, 40)],
    [...red(24, 4, 40), ...red(44, 4, 40)],
  ),
  "park-terrace-down": {
    ...moduleChunk(
      "park",
      1,
      40,
      50,
      [floor(0, 12, 40), floor(12, 12, 45), floor(24, 16, 50), floor(40, 4, 47), floor(44, 16, 50)],
      [],
    ),
    slots: [{ area: { col: 46, cols: 6, row: 44, rows: 6 }, id: "lawn", kind: "event" }],
  },
  "park-terrace-up": PARK_UP,
  "park-upper-terrace": {
    ...shifted(-10, PARK_UP),
    objects: [
      ...shifted(-10, PARK_UP).objects,
      { character: "park-branch", col: 44, role: "branch", row: 24 },
    ],
    theme: "park",
  },
  "warned-vent-terrace": moduleChunk(
    MECHANICAL_THEMES,
    4,
    50,
    50,
    [floor(0, 12, 50), floor(12, 12, 47), floor(24, 12, 44), floor(36, 12, 47), floor(48, 12, 50)],
    [{ character: "warned-vent", col: 28, row: 38 }],
  ),
  ...APARTMENT_CHUNKS,
  ...COUNTRYSIDE_CHUNKS,
  ...HOME_CITY_CHUNKS,
  ...INDUSTRIAL_CHUNKS,
  ...STREET_CHUNKS,
  ...WOODLAND_CHUNKS,
};

const ROOM_DOOR_COLUMNS: Readonly<Record<string, number>> = {
  "apartment-room": 1,
  "country-room": 17,
  "depot-room": 40,
  "encounter-room": 6,
  "loading-room": 17,
};

function roomDoorSlot(slot: NonNullable<ChunkPlan["slots"]>[number]): typeof slot {
  const col = ROOM_DOOR_COLUMNS[slot.id];
  return slot.kind !== "door" || col === undefined
    ? slot
    : {
        ...slot,
        area: { col, cols: 5, row: slot.area.row + slot.area.rows - 7, rows: 7 },
      };
}

const BASE_CHUNKS: Readonly<Record<string, ChunkPlan>> = Object.fromEntries(
  Object.entries(AUTHORED_CHUNKS).map(([id, authored]) => {
    const chunk = withValleyFloors(authored);
    return [
      id,
      {
        ...chunk,
        ...(chunk.slots && { slots: chunk.slots.map(roomDoorSlot) }),
      },
    ];
  }),
);

const DEPTH_CAPS = new Set([
  "apartment-start",
  "back-streets-start",
  "city-boundary-start",
  "city-outskirts-start",
  "city-streets-start",
  "country-lanes-start",
  "deep-woods-start",
  "familiar-neighbourhood-start",
  "farmland-start",
  "forest-paths-start",
  "freight-terminal-start",
  "loading-yards-start",
  "ravine-start",
  "river-crossing-start",
  "street-finish",
  "warehouse-district-start",
]);

export const EXTERIOR_DEPTH_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  [
    "city-boundary-ground-hazard",
    "compound-low-ceiling-hazard",
    "compound-low-ceiling-shuttle",
    "compound-return-high",
    "compound-return-terrace",
    "horizontal-platform-orbit",
  ].map((id) => [id, `${id}-exterior`]),
);

export const WOODLAND_DEPTH_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  [
    "city-boundary-ground-hazard",
    "compound-low-ceiling-hazard",
    "compound-low-ceiling-shuttle",
    "compound-return-high",
    "compound-return-shuttle",
    "compound-return-terrace",
    "compound-transfer-gate",
    "crumbling-support-crossing",
    "horizontal-platform-orbit",
    "vertical-red-gate",
    "warned-vent-terrace",
  ].map((id) => [id, `${id}-woodland-depth`]),
);

export const GROUND_CHALLENGES: ChunkPool = [
  "broad-mesa",
  "low-central-crossing",
  "city-boundary-ground-hazard",
  "compound-ascent",
  "compound-compact-ascent",
  "compound-compact-climb",
  "compound-low-ceiling-hazard",
  "compound-return-terrace",
  "compound-transfer-gate",
  "crumbling-support-crossing",
  "warned-vent-terrace",
];
const JUMP_CHALLENGES: ChunkPool = [
  "city-boundary-edge-yard",
  "city-boundary-gaps",
  "city-boundary-jumps",
  "city-boundary-low-ceiling",
  "city-boundary-return-gap",
  "city-boundary-steps",
  "city-boundary-upper-climb",
  "guarded-valley",
  "overjump-low-roof",
];
export const INDUSTRIAL_CHALLENGES: ChunkPool = [
  ...GROUND_CHALLENGES,
  ...JUMP_CHALLENGES,
  "city-boundary-lift",
  "city-boundary-shuttle",
  "compound-double-lift",
  "compound-lift-shuttle",
  "compound-low-ceiling-shuttle",
  "compound-return-high",
  "horizontal-platform-orbit",
  "vertical-platform-orbit",
  "vertical-red-gate",
];

export const BLUE_CHALLENGES: ChunkPool = [
  ...GROUND_CHALLENGES,
  ...JUMP_CHALLENGES,
  "city-boundary-lift",
  "city-boundary-shuttle",
  "compound-return-shuttle",
  "horizontal-platform-orbit",
  "vertical-platform-orbit",
  "vertical-red-gate",
];

export const COUNTRYSIDE_CHALLENGES: ChunkPool = [
  ...GROUND_CHALLENGES,
  ...JUMP_CHALLENGES,
  "city-boundary-shuttle",
  "compound-low-ceiling-shuttle",
  "compound-return-high",
  "compound-return-shuttle",
  "horizontal-platform-orbit",
  "vertical-platform-orbit",
  "vertical-red-gate",
];

export const WOODLAND_CHALLENGES: ChunkPool = [
  ...GROUND_CHALLENGES,
  "compound-double-lift",
  "compound-low-ceiling-shuttle",
  "compound-return-high",
  "compound-return-shuttle",
  "horizontal-platform-orbit",
  "vertical-platform-orbit",
  "vertical-red-gate",
];

export const HOME_CHALLENGES: ChunkPool = [
  ...GROUND_CHALLENGES,
  "compound-double-lift",
  "compound-low-ceiling-shuttle",
  "compound-return-high",
  "horizontal-platform-orbit",
  "vertical-platform-orbit",
  "vertical-red-gate",
];

export const FOUR_SCREEN_ROWS = (4 * SCREEN.height) / TILE;
export const INDUSTRIAL_ROWS = FOUR_SCREEN_ROWS;
const LOWER_ROUTE_OFFSET = 30;
export const INDUSTRIAL_ROOF_ROW = 35;
export const INDUSTRIAL_THEMES = ["freight-terminal", "loading-yards", "warehouse-district"];
export const industrialCapId = (id: string): string => `industrial-tall-${id}`;
export const industrialTunnelId = (id: string): string => `industrial-tunnel-${id}`;
export const INDUSTRIAL_CONNECTORS = [
  "industrial-descent",
  "industrial-ascent",
  "industrial-deep-descent",
  "industrial-deep-ascent",
] as const;

export function tunnelWalls(): readonly Instance[] {
  const bandRows = 20;
  const top = 50;
  return Array.from({ length: Math.ceil((INDUSTRIAL_ROWS - top) / bandRows) }, (_, index) => ({
    backdropPlane: "interior",
    backdropSpan: true,
    character: "apartment-wall-panel",
    col: 0,
    cols: CHUNK_COLS,
    groundAnchor: "start",
    parallax: { x: 0.8, y: 1 },
    role: "tunnel-wall",
    row: top + index * bandRows,
    rows: Math.min(bandRows, INDUSTRIAL_ROWS - top - index * bandRows),
  }));
}

function fourScreenChunk(
  context: { readonly offset: number; readonly underground: boolean },
  chunk: ChunkPlan,
): ChunkPlan {
  const { offset, underground } = context;
  const point = <T extends { readonly row: number }>(value: T): T => ({
    ...value,
    row: value.row + offset,
  });
  return {
    ...chunk,
    backdrops: (chunk.backdrops ?? []).map(point),
    entry: { row: (chunk.entry.row + offset) as ChunkPlan["entry"]["row"] },
    exit: { row: (chunk.exit.row + offset) as ChunkPlan["exit"]["row"] },
    ...(chunk.noCross && {
      noCross: chunk.noCross.map(({ from, to }) => ({ from: point(from), to: point(to) })),
    }),
    objects: chunk.objects.map(point),
    ...((chunk.outOfReach || underground) && {
      outOfReach: [
        ...(chunk.outOfReach ?? []).map(point),
        ...(underground ? [{ col: CHUNK_COLS / 2, row: INDUSTRIAL_ROOF_ROW }] : []),
      ],
    }),
    rows: FOUR_SCREEN_ROWS,
    scenery: [...(chunk.scenery ?? []).map(point), ...(underground ? tunnelWalls() : [])],
    ...(chunk.slots && {
      slots: chunk.slots.map(roomDoorSlot).map((slot) => ({ ...slot, area: point(slot.area) })),
    }),
    solids: [
      ...chunk.solids.map((solid) => ({
        ...point(solid),
        rows:
          solid.row + solid.rows === ZONE_ROWS ? FOUR_SCREEN_ROWS - solid.row - offset : solid.rows,
      })),
      ...(underground
        ? [{ col: 0, cols: CHUNK_COLS, look: "ground", row: INDUSTRIAL_ROOF_ROW, rows: 1 }]
        : []),
    ],
    theme: underground ? INDUSTRIAL_THEMES : chunk.theme,
  };
}

function industrialStairs(rows: readonly number[]): ChunkPlan {
  const final = rows.length - 1;
  const solids = rows.map((row, index) => {
    const col = index === 0 ? 0 : 8 + (index - 1) * 6;
    return {
      col,
      cols: index === final ? CHUNK_COLS - col : index === 0 ? 8 : 6,
      look: "ground",
      row,
      rows: INDUSTRIAL_ROWS - row,
    };
  });
  return {
    cols: CHUNK_COLS,
    difficulty: 3,
    encounters: 0,
    entry: { row: rows[0] as ChunkPlan["entry"]["row"] },
    exit: { row: rows[final] as ChunkPlan["exit"]["row"] },
    maxPerZone: 1,
    objects: [],
    rows: INDUSTRIAL_ROWS,
    scenery: tunnelWalls(),
    solids,
    theme: INDUSTRIAL_THEMES,
  };
}

const INDUSTRIAL_VERTICAL_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  ...Object.fromEntries(
    Object.entries(INDUSTRIAL_CHUNKS).map(([id, chunk]) => [
      industrialCapId(id),
      fourScreenChunk({ offset: 0, underground: false }, chunk),
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(BASE_CHUNKS)
      .filter(([id]) => INDUSTRIAL_CHALLENGES.includes(id))
      .map(([id, chunk]) => [
        industrialTunnelId(id),
        fourScreenChunk({ offset: LOWER_ROUTE_OFFSET, underground: true }, chunk),
      ]),
  ),
  "industrial-ascent": industrialStairs([80, 75, 70, 65, 60, 55, 50]),
  "industrial-deep-ascent": industrialStairs([100, 95, 90, 85, 80]),
  "industrial-deep-descent": industrialStairs([80, 75, 80, 85, 90, 95, 100]),
  "industrial-descent": industrialStairs([50, 45, 50, 55, 60, 65, 70, 75, 80]),
};

export const BLUE_THEMES = ["street", "city-streets", "city-boundary"];
export const COUNTRYSIDE_THEMES = ["country-lanes", "farmland", "river-crossing"];
export const WOODLAND_ROUTE_THEMES = ["deep-woods", "forest-paths", "ravine"];
export const HOME_ROUTE_THEMES = ["back-streets", "city-outskirts", "familiar-neighbourhood"];
const LIFT_GATE_THEMES = [...BLUE_THEMES, ...WOODLAND_ROUTE_THEMES, ...HOME_ROUTE_THEMES];
const OPEN_ROUTE_THEMES = [...BLUE_THEMES, ...COUNTRYSIDE_THEMES];
export const blueVerticalId = (id: string): string => `blue-vertical-${id}`;
export const BLUE_CONNECTORS = [
  "outdoor-descent",
  "outdoor-lift-ascent",
  "outdoor-upper-ascent",
  "outdoor-surface-return",
  "outdoor-deep-descent",
  "outdoor-deep-ascent",
] as const;

function outdoorStairs(rows: readonly number[]): ChunkPlan {
  return { ...industrialStairs(rows), scenery: [], theme: OPEN_ROUTE_THEMES };
}
const blueFloor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: FOUR_SCREEN_ROWS - row,
});
const BLUE_VERTICAL_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  ...Object.fromEntries(
    Object.entries(BASE_CHUNKS)
      .filter(([id, chunk]) => {
        const themes = typeof chunk.theme === "string" ? [chunk.theme] : chunk.theme;
        return (
          BLUE_CHALLENGES.includes(id) ||
          (themes.length === 1 && BLUE_THEMES.includes(themes[0]!) && /-(start|finish)$/.test(id))
        );
      })
      .map(([id, chunk]) => [
        blueVerticalId(id),
        fourScreenChunk(
          { offset: BLUE_CHALLENGES.includes(id) ? LOWER_ROUTE_OFFSET : 0, underground: false },
          chunk,
        ),
      ]),
  ),
  "outdoor-deep-ascent": outdoorStairs([100, 95, 90, 85, 80]),
  "outdoor-deep-descent": outdoorStairs([80, 75, 80, 85, 90, 95, 100]),
  "outdoor-descent": outdoorStairs([50, 45, 50, 55, 60, 65, 70, 75, 80]),
  "outdoor-lift-ascent": withValleyFloors({
    cols: CHUNK_COLS,
    difficulty: 4,
    encounters: 0,
    entry: { row: 80 },
    exit: { row: 40 },
    maxPerZone: 1,
    objects: [
      {
        ...lift(27, 65),
        behaviour: { ...CITY_LIFT_BEHAVIOUR, initial: "wait-far" },
        forcedTransit: OUTDOOR_LIFT_ASCENT_TRANSIT,
      },
    ],
    rows: FOUR_SCREEN_ROWS,
    solids: [
      blueFloor(0, 8, 80),
      blueFloor(8, 6, 75),
      blueFloor(14, 6, 70),
      blueFloor(20, 6, 65),
      blueFloor(34, 6, 50),
      blueFloor(40, 6, 45),
      blueFloor(46, 14, 40),
    ],
    theme: LIFT_GATE_THEMES,
  }),
  "outdoor-surface-return": {
    ...outdoorStairs([20, 15, 20, 25, 30, 35, 40, 45, 50]),
    solids: [
      ...outdoorStairs([20, 15, 20, 25, 30, 35, 40, 45, 50]).solids,
      { col: 28, cols: 4, look: "raised", row: 0, rows: 24 },
      { col: 46, cols: 4, look: "raised", row: 0, rows: 39 },
    ],
  },
  "outdoor-upper-ascent": {
    cols: CHUNK_COLS,
    difficulty: 4,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 20 },
    maxPerZone: 1,
    objects: BASE_CHUNKS["vertical-red-gate"]!.objects.map((object) => ({
      ...object,
      col: 28,
      row: 24,
    })),
    rows: FOUR_SCREEN_ROWS,
    solids: [
      blueFloor(0, 8, 40),
      blueFloor(8, 12, 35),
      blueFloor(20, 12, 30),
      blueFloor(32, 12, 25),
      blueFloor(44, 16, 20),
    ],
    theme: LIFT_GATE_THEMES,
  },
};

export const countrysideVerticalId = (id: string): string => `countryside-vertical-${id}`;
export const COUNTRYSIDE_CONNECTORS = [
  "outdoor-descent",
  "outdoor-terrace-ascent",
  "outdoor-ferry-ascent",
  "outdoor-surface-return",
  "outdoor-deep-descent",
  "outdoor-deep-ascent",
] as const;

const COUNTRYSIDE_VERTICAL_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  ...Object.fromEntries(
    Object.entries(BASE_CHUNKS)
      .filter(([id, chunk]) => {
        const themes = typeof chunk.theme === "string" ? [chunk.theme] : chunk.theme;
        return (
          COUNTRYSIDE_CHALLENGES.includes(id) ||
          (themes.length === 1 &&
            COUNTRYSIDE_THEMES.includes(themes[0]!) &&
            /-(start|finish)$/.test(id))
        );
      })
      .map(([id, chunk]) => [
        countrysideVerticalId(id),
        fourScreenChunk(
          {
            offset: COUNTRYSIDE_CHALLENGES.includes(id) ? LOWER_ROUTE_OFFSET : 0,
            underground: false,
          },
          chunk,
        ),
      ]),
  ),
  "outdoor-ferry-ascent": {
    cols: CHUNK_COLS,
    difficulty: 4,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 20 },
    maxPerZone: 1,
    objects: [shuttle(18, 35, 16), ...red(18, 22, 45)],
    rows: FOUR_SCREEN_ROWS,
    solids: [
      blueFloor(0, 12, 40),
      blueFloor(12, 6, 35),
      blueFloor(18, 22, 45),
      blueFloor(40, 6, 35),
      blueFloor(46, 6, 30),
      blueFloor(52, 4, 25),
      blueFloor(56, 4, 20),
    ],
    theme: OPEN_ROUTE_THEMES,
  },
  "outdoor-terrace-ascent": outdoorStairs([80, 75, 70, 65, 60, 55, 50, 45, 40]),
};

export const woodlandVerticalId = (id: string): string => `woodland-vertical-${id}`;
export const WOODLAND_VERTICAL_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  WOODLAND_CHALLENGES.map((id) => [id, woodlandVerticalId(id)]),
);
export const WOODLAND_CONNECTORS = [
  "woodland-timed-descent",
  "outdoor-lift-ascent",
  "outdoor-upper-ascent",
  "woodland-timed-return",
  "woodland-deep-descent",
  "woodland-deep-ascent",
] as const;

function woodlandHeight(id: string, chunk: ChunkPlan): ChunkPlan {
  const layered = WOODLAND_DEPTH_ALIASES[id]
    ? {
        ...chunk,
        backdrops: [...woodlandDepth(localDepth(0)), ...(chunk.backdrops ?? [])],
        scenery: WOODLAND_SCENERY[id] ?? [],
        theme: WOODLAND_ROUTE_THEMES,
      }
    : chunk;
  const offset = WOODLAND_CHALLENGES.includes(id) ? LOWER_ROUTE_OFFSET : 0;
  const tall = fourScreenChunk({ offset, underground: false }, layered);
  const visual = (instance: Instance): Instance =>
    instance.parallax && instance.parallax.y < 1
      ? instance
      : { ...instance, row: instance.row + offset };
  return {
    ...tall,
    backdrops: (layered.backdrops ?? []).map(visual),
    scenery: (layered.scenery ?? []).map(visual),
  };
}

function guardedWoodlandStairs(col: number, rows: readonly number[]): ChunkPlan {
  const chunk = outdoorStairs(rows);
  const ground = chunk.solids.find((solid) => solid.col <= col && solid.col + solid.cols > col)!;
  return {
    ...chunk,
    difficulty: 4,
    objects: BASE_CHUNKS["vertical-red-gate"]!.objects.map((object) => ({
      ...object,
      col,
      row: ground.row - object.rows!,
    })),
    theme: WOODLAND_ROUTE_THEMES,
  };
}

const WOODLAND_VERTICAL_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  ...Object.fromEntries(
    Object.entries(BASE_CHUNKS)
      .filter(([id, chunk]) => {
        const themes = typeof chunk.theme === "string" ? [chunk.theme] : chunk.theme;
        return (
          WOODLAND_CHALLENGES.includes(id) ||
          (themes.length === 1 &&
            WOODLAND_ROUTE_THEMES.includes(themes[0]!) &&
            /-(start|finish)$/.test(id))
        );
      })
      .map(([id, chunk]) => [woodlandVerticalId(id), woodlandHeight(id, chunk)]),
  ),
  "woodland-deep-ascent": guardedWoodlandStairs(36, [100, 95, 90, 85, 80]),
  "woodland-deep-descent": guardedWoodlandStairs(17, [80, 75, 80, 85, 90, 95, 100]),
  "woodland-timed-descent": guardedWoodlandStairs(17, [50, 45, 50, 55, 60, 65, 70, 75, 80]),
  "woodland-timed-return": guardedWoodlandStairs(17, [20, 15, 20, 25, 30, 35, 40, 45, 50]),
};

export const homeVerticalId = (id: string): string => `home-vertical-${id}`;
export const HOME_CONNECTORS = [
  "home-timed-descent",
  "outdoor-lift-ascent",
  "outdoor-upper-ascent",
  "home-timed-return",
  "home-deep-descent",
  "home-deep-ascent",
] as const;
const HOME_VERTICAL_CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  ...Object.fromEntries(
    Object.entries(BASE_CHUNKS)
      .filter(([id, chunk]) => {
        const themes = typeof chunk.theme === "string" ? [chunk.theme] : chunk.theme;
        return (
          HOME_CHALLENGES.includes(id) ||
          (themes.length === 1 &&
            HOME_ROUTE_THEMES.includes(themes[0]!) &&
            /-(start|finish)$/.test(id))
        );
      })
      .map(([id, chunk]) => [
        homeVerticalId(id),
        fourScreenChunk(
          { offset: HOME_CHALLENGES.includes(id) ? LOWER_ROUTE_OFFSET : 0, underground: false },
          chunk,
        ),
      ]),
  ),
  ...Object.fromEntries(
    ["timed-descent", "timed-return", "deep-descent", "deep-ascent"].map((kind) => [
      `home-${kind}`,
      { ...WOODLAND_VERTICAL_CHUNKS[`woodland-${kind}`]!, theme: HOME_ROUTE_THEMES },
    ]),
  ),
};

export const CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  ...HOME_VERTICAL_CHUNKS,
  ...WOODLAND_VERTICAL_CHUNKS,
  ...COUNTRYSIDE_VERTICAL_CHUNKS,
  ...BLUE_VERTICAL_CHUNKS,
  ...INDUSTRIAL_VERTICAL_CHUNKS,
  ...createApartmentMiddleChunks(BASE_CHUNKS),
  ...Object.fromEntries(
    Object.entries(BASE_CHUNKS).map(([id, chunk]) => [
      id,
      DEPTH_CAPS.has(id)
        ? {
            ...chunk,
            backdrops: [
              ...(["deep-woods-start", "forest-paths-start", "ravine-start"].includes(id)
                ? woodlandDepth(localDepth(0))
                : localDepth(id === "apartment-start" ? 10 : 0)),
              ...(chunk.backdrops ?? []),
            ],
          }
        : chunk,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(EXTERIOR_DEPTH_ALIASES).map(([id, alias]) => {
      const chunk = BASE_CHUNKS[id]!;
      return [
        alias,
        {
          ...chunk,
          backdrops: [...localDepth(10), ...(chunk.backdrops ?? [])],
          theme: "apartment-exterior",
        },
      ];
    }),
  ),
  ...Object.fromEntries(
    Object.entries(WOODLAND_DEPTH_ALIASES).map(([id, alias]) => {
      const chunk = BASE_CHUNKS[id]!;
      return [
        alias,
        {
          ...chunk,
          backdrops: [...woodlandDepth(localDepth(0)), ...(chunk.backdrops ?? [])],
          scenery: WOODLAND_SCENERY[id] ?? [],
          theme: ["deep-woods", "forest-paths", "ravine"],
        },
      ];
    }),
  ),
};
