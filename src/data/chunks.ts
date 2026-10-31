import { GROWL_FINISH, PATROL_FINISH_GEOMETRY } from "./chunkTemplates";
import type {
  ChunkPlan,
  ChunkRules,
  ElementBinding,
  Instance,
  TerrainRect,
  ThemePlan,
} from "./types";
import { STREET_CHUNKS } from "./zone1";
import { INDUSTRIAL_CHUNKS } from "./zone2";
import { COUNTRYSIDE_CHUNKS } from "./zone3";
import { WOODLAND_CHUNKS } from "./zone4";
import { HOME_CITY_CHUNKS } from "./zone5";
import { APARTMENT_CHUNKS } from "./zone6";

// The rows a chunk's entry and exit stand on.
export const SEAM_ROWS = [30, 40, 50] as const;

export const CHUNK_RULES: ChunkRules = {
  cols: { max: 120, min: 60 },
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
const PATROL_THEMES = [
  "city-streets",
  "country-lanes",
  ...APARTMENT_THEMES,
  "city-boundary",
  "farmland",
  "river-crossing",
  "street",
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
  backdrops: [
    { character: "street-sky", parallax: { x: 0, y: 0 }, role: "sky", row: 0 },
    {
      character: "street-city-far",
      parallax: { x: 0.15, y: 0.05 },
      role: "far-background",
      row: 0,
    },
    { character: "street-city-mid", parallax: { x: 0.4, y: 0.15 }, role: "mid-background", row: 0 },
  ],
  bindings: {
    ...COMMON_BINDINGS,
    antagonist: { character: "dog-antagonist", scene: null },
    "antagonist-intro": {
      character: "dog-antagonist",
      scene: null,
    },
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
};

const COMMON_BACKDROPS: ThemePlan["backdrops"] = [
  { character: "street-sky", parallax: { x: 0, y: 0 }, role: "sky", row: 0 },
  { character: "street-city-far", parallax: { x: 0.15, y: 0.05 }, role: "far-background", row: 0 },
  { character: "street-city-mid", parallax: { x: 0.4, y: 0.15 }, role: "mid-background", row: 0 },
];

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
        ? [
            { character: "street-sky", parallax: { x: 0, y: 0 }, role: "sky", row: 10 },
            {
              character: "street-city-far",
              parallax: { x: 0.15, y: 0.05 },
              role: "far-background",
              row: 10,
            },
            {
              character: "street-city-mid",
              parallax: { x: 0.4, y: 0.15 },
              role: "mid-background",
              row: 10,
            },
          ]
        : [0, 12, 24, 36, 48].map((row) => ({
            character: "apartment-wall-panel",
            parallax: { x: 1, y: 1 },
            role: "wall",
            row,
          })),
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
            wall === "apartment-wall-residential" ? "apartment-room-door" : "apartment-stairwell",
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
    bindings: HOME_CITY_BINDINGS,
    door: "door",
    looks: { ground: "outskirts-ground", raised: "brick-stack" },
    tileset: "tiles-homecity",
  },
  "city-streets": CITY_THEME,
  "country-lanes": {
    backdrops: COMMON_BACKDROPS,
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
    bindings: WOODLAND_BINDINGS,
    door: "door",
    looks: { ground: "forest-ground", raised: "root-stack" },
    tileset: "tiles-woodland",
  },
  "familiar-neighbourhood": {
    backdrops: COMMON_BACKDROPS,
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
    bindings: COUNTRYSIDE_BINDINGS,
    door: "door",
    looks: { ground: "country-ground", raised: "hay-stack" },
    tileset: "tiles-countryside",
  },
  "forest-paths": {
    backdrops: COMMON_BACKDROPS,
    bindings: WOODLAND_BINDINGS,
    door: "door",
    looks: { ground: "forest-ground", raised: "root-stack" },
    tileset: "tiles-woodland",
  },
  "freight-terminal": {
    backdrops: COMMON_BACKDROPS,
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
    bindings: {
      ...WOODLAND_BINDINGS,
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
    bindings: INDUSTRIAL_BINDINGS,
    door: "door",
    looks: { ground: "industrial-floor", raised: "crate-stack" },
    tileset: "tiles-industrial",
  },
};

const COMPACT_HAZARD_ASCENT: ChunkPlan = {
  cols: 72,
  difficulty: 4,
  encounters: 0,
  entry: { row: 50 },
  exit: { row: 40 },
  objects: [
    { character: "platform-ledge", col: 8, cols: 6, role: "ledge", row: 45 },
    { character: "city-ground-hazard", col: 18, role: "moving-hazard", row: 49 },
    { character: "platform-ledge", col: 36, cols: 6, role: "ledge", row: 45 },
  ],
  solids: [
    { col: 0, cols: 42, look: "ground", row: 50, rows: 10 },
    { col: 42, cols: 6, look: "raised", row: 45, rows: 15 },
    { col: 48, cols: 24, look: "raised", row: 40, rows: 20 },
  ],
  theme: MECHANICAL_THEMES,
};
const COMPACT_CLIMB_OFFSET = COMPACT_HAZARD_ASCENT.exit.row - SEAM_ROWS[0];

// The raised route leaves 45px above the bird for a 40px tap beneath the red band.
const TAP_CEILING_OBJECTS: readonly Instance[] = [
  { character: "red-edge-bottom", col: 20, cols: 24, role: "edge-bottom", row: 40 },
  { character: "red-edge-left", col: 19, role: "edge-left", row: 38, rows: 2 },
  { character: "red-edge-right", col: 44, role: "edge-right", row: 38, rows: 2 },
  { character: "red-edge-top", col: 20, cols: 24, role: "edge-top", row: 37 },
  { character: "red-edge-support", col: 20, cols: 24, role: "support", row: 38, rows: 2 },
];
const TAP_CEILING_TERRAIN: readonly TerrainRect[] = [
  { col: 0, cols: 12, look: "ground", row: 50, rows: 10 },
  { col: 12, cols: 16, look: "raised", row: 47, rows: 13 },
  { col: 28, cols: 6, look: "raised", row: 46, rows: 14 },
  { col: 34, cols: 16, look: "raised", row: 47, rows: 13 },
];

const GROWL_ROW_OFFSET = 10;
const GROWL_COL_OFFSET = 18;

// The chunks zones are assembled from, by id. Rows are the chunk's own: seams at 50 (the lawn), 40
// and 30 (the terraces). Every required rise is at most 6 and every required gap at most 16, and
// moving-platform crossings exceed the running jump's reach of 19.
export const CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  "bounded-flyer-post": {
    cols: 96,
    difficulty: 4,
    encounters: 1,
    entry: { row: 40 },
    exit: { row: 30 },
    objects: [
      { character: "platform-ledge", col: 34, cols: 6, role: "ledge", row: 35 },
      { character: "pigeon-antagonist", col: 46, role: "antagonist", row: 26 },
      { character: "platform-ledge", col: 64, cols: 6, role: "ledge", row: 35 },
    ],
    solids: [
      { col: 0, cols: 46, look: "ground", row: 40, rows: 20 },
      { col: 46, cols: 4, look: "raised", row: 30, rows: 30 },
      { col: 50, cols: 28, look: "ground", row: 40, rows: 20 },
      { col: 78, cols: 6, look: "raised", row: 35, rows: 25 },
      { col: 84, cols: 12, look: "raised", row: 30, rows: 30 },
    ],
    theme: ["freight-terminal", "loading-yards", "warehouse-district"],
    weight: 2,
  },
  "city-boundary-climb-yard": {
    backdrops: [
      { character: "facade-one-storey", col: 4, cols: 12, role: "near-wall", row: 34 },
      { character: "facade-one-storey", col: 42, cols: 16, role: "near-wall", row: 24 },
    ],
    cols: 96,
    difficulty: 4,
    encounters: 1,
    entry: { row: 50 },
    exit: { row: 40 },
    objects: [
      { character: "platform-ledge", col: 34, cols: 6, role: "ledge", row: 36 },
      { character: "dog-antagonist", col: 59, role: "antagonist", row: 36 },
      { character: "platform-ledge", col: 70, cols: 6, role: "ledge", row: 36 },
    ],
    solids: [
      { col: 0, cols: 18, look: "ground", row: 50, rows: 10 },
      { col: 18, cols: 12, look: "raised", row: 45, rows: 15 },
      { col: 30, cols: 66, look: "raised", row: 40, rows: 20 },
    ],
    theme: PATROL_THEMES,
    weight: 2,
  },
  "city-boundary-dog-high": {
    backdrops: [{ character: "facade-one-storey", col: 8, cols: 16, role: "near-wall", row: 14 }],
    cols: 84,
    difficulty: 4,
    encounters: 1,
    entry: { row: 30 },
    exit: { row: 30 },
    objects: [
      { character: "platform-ledge", col: 10, cols: 6, role: "ledge", row: 26 },
      { character: "dog-antagonist", col: 35, role: "antagonist", row: 26 },
      { character: "platform-ledge", col: 46, cols: 6, role: "ledge", row: 26 },
    ],
    solids: [{ col: 0, cols: 84, look: "raised", row: 30, rows: 30 }],
    theme: PATROL_THEMES,
    weight: 2,
  },
  "city-boundary-dog-terrace": {
    backdrops: [{ character: "facade-one-storey", col: 8, cols: 16, role: "near-wall", row: 24 }],
    cols: 84,
    difficulty: 4,
    encounters: 1,
    entry: { row: 40 },
    exit: { row: 40 },
    objects: [
      { character: "platform-ledge", col: 10, cols: 6, role: "ledge", row: 36 },
      { character: "dog-antagonist", col: 35, role: "antagonist", row: 36 },
      { character: "platform-ledge", col: 46, cols: 6, role: "ledge", row: 36 },
    ],
    solids: [{ col: 0, cols: 84, look: "raised", row: 40, rows: 20 }],
    theme: PATROL_THEMES,
    weight: 2,
  },
  "city-boundary-edge-yard": {
    backdrops: [{ character: "facade-one-storey", col: 8, cols: 12, role: "near-wall", row: 34 }],
    cols: 84,
    difficulty: 2,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 40 },
    objects: [
      { character: "platform-ledge", col: 16, cols: 8, role: "ledge", row: 45 },
      { character: "red-edge-top", col: 24, cols: 4, role: "edge-top", row: 49 },
      { character: "red-edge-support", col: 24, cols: 4, role: "support", row: 50, rows: 10 },
      { character: "platform-ledge", col: 36, cols: 8, role: "ledge", row: 44 },
      { character: "red-edge-top", col: 52, cols: 4, role: "edge-top", row: 49 },
      { character: "red-edge-support", col: 52, cols: 4, role: "support", row: 50, rows: 10 },
    ],
    solids: [
      { col: 0, cols: 24, look: "ground", row: 50, rows: 10 },
      { col: 28, cols: 24, look: "ground", row: 50, rows: 10 },
      { col: 56, cols: 4, look: "ground", row: 50, rows: 10 },
      { col: 60, cols: 12, look: "raised", row: 45, rows: 15 },
      { col: 72, cols: 12, look: "raised", row: 40, rows: 20 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "city-boundary-finish": {
    backdrops: [
      { character: "facade-one-storey", col: 6, cols: 8, role: "near-wall", row: 34 },
      { character: "fire-escape-railing", col: 8, cols: 6, role: "fire-escape-railing", row: 44 },
      { character: "fire-escape-railing", col: 42, cols: 6, role: "fire-escape-railing", row: 44 },
    ],
    cols: 60,
    difficulty: 1,
    entry: { row: 50 },
    exit: { row: 50 },
    ...PATROL_FINISH_GEOMETRY,
    theme: "city-boundary",
  },
  "city-boundary-gaps": {
    backdrops: [{ character: "facade-one-storey", col: 4, cols: 12, role: "near-wall", row: 34 }],
    cols: 84,
    difficulty: 2,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 40 },
    objects: [
      { character: "red-edge-top", col: 20, cols: 12, role: "edge-top", row: 54 },
      { character: "red-edge-support", col: 20, cols: 12, role: "support", row: 55, rows: 5 },
      { character: "red-edge-top", col: 48, cols: 16, role: "edge-top", row: 54 },
      { character: "red-edge-support", col: 48, cols: 16, role: "support", row: 55, rows: 5 },
    ],
    solids: [
      { col: 0, cols: 20, look: "ground", row: 50, rows: 10 },
      { col: 32, cols: 16, look: "ground", row: 50, rows: 10 },
      { col: 64, cols: 8, look: "ground", row: 50, rows: 10 },
      { col: 72, cols: 6, look: "raised", row: 45, rows: 15 },
      { col: 78, cols: 6, look: "raised", row: 40, rows: 20 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "city-boundary-ground-hazard": {
    backdrops: [{ character: "facade-one-storey", col: 8, cols: 12, role: "near-wall", row: 24 }],
    cols: 84,
    difficulty: 4,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 40 },
    objects: [
      { character: "platform-ledge", col: 16, cols: 8, role: "ledge", row: 35 },
      { character: "city-ground-hazard", col: 30, role: "moving-hazard", row: 39 },
      { character: "platform-ledge", col: 44, cols: 8, role: "ledge", row: 35 },
    ],
    solids: [{ col: 0, cols: 84, look: "raised", row: 40, rows: 20 }],
    theme: MECHANICAL_THEMES,
    weight: 2,
  },
  "city-boundary-jumps": {
    backdrops: [{ character: "facade-one-storey", col: 12, cols: 12, role: "near-wall", row: 34 }],
    cols: 72,
    difficulty: 2,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 40 },
    objects: [],
    solids: [
      { col: 0, cols: 20, look: "ground", row: 50, rows: 10 },
      { col: 20, cols: 10, look: "raised", row: 44, rows: 16 },
      { col: 30, cols: 14, look: "raised", row: 48, rows: 12 },
      { col: 44, cols: 10, look: "raised", row: 44, rows: 16 },
      { col: 54, cols: 18, look: "raised", row: 40, rows: 20 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "city-boundary-lift": {
    backdrops: [{ character: "facade-one-storey", col: 48, cols: 16, role: "near-wall", row: 14 }],
    cols: 84,
    difficulty: 3,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 30 },
    objects: [
      { character: "city-lift", col: 22, role: "lift", row: 40 },
      { character: "red-edge-top", col: 18, cols: 16, role: "edge-top", row: 46 },
      { character: "red-edge-support", col: 18, cols: 16, role: "support", row: 47, rows: 13 },
    ],
    solids: [
      { col: 0, cols: 18, look: "raised", row: 40, rows: 20 },
      { col: 34, cols: 50, look: "raised", row: 30, rows: 30 },
    ],
    theme: MECHANICAL_THEMES,
    weight: 2,
  },
  // The red ceiling leaves room for a short hop over the step, but not a full held jump.
  "city-boundary-low-ceiling": {
    cols: 72,
    difficulty: 3,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 40 },
    objects: [
      { character: "red-edge-bottom", col: 20, cols: 18, role: "edge-bottom", row: 42 },
      { character: "red-edge-left", col: 19, role: "edge-left", row: 40, rows: 2 },
      { character: "red-edge-right", col: 38, role: "edge-right", row: 40, rows: 2 },
      { character: "red-edge-top", col: 20, cols: 18, role: "edge-top", row: 39 },
      { character: "red-edge-support", col: 20, cols: 18, role: "support", row: 40, rows: 2 },
    ],
    solids: [
      { col: 0, cols: 26, look: "ground", row: 50, rows: 10 },
      { col: 26, cols: 6, look: "raised", row: 49, rows: 11 },
      { col: 32, cols: 12, look: "ground", row: 50, rows: 10 },
      { col: 44, cols: 14, look: "raised", row: 45, rows: 15 },
      { col: 58, cols: 14, look: "raised", row: 40, rows: 20 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "city-boundary-return-gap": {
    cols: 96,
    difficulty: 3,
    encounters: 0,
    entry: { row: 30 },
    exit: { row: 50 },
    objects: [
      { character: "red-edge-top", col: 30, cols: 16, role: "edge-top", row: 44 },
      { character: "red-edge-support", col: 30, cols: 16, role: "support", row: 45, rows: 15 },
    ],
    solids: [
      { col: 0, cols: 18, look: "raised", row: 30, rows: 30 },
      { col: 18, cols: 12, look: "raised", row: 35, rows: 25 },
      { col: 46, cols: 12, look: "raised", row: 35, rows: 25 },
      { col: 58, cols: 12, look: "raised", row: 40, rows: 20 },
      { col: 70, cols: 12, look: "raised", row: 45, rows: 15 },
      { col: 82, cols: 14, look: "ground", row: 50, rows: 10 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "city-boundary-return-high": {
    cols: 72,
    difficulty: 2,
    encounters: 0,
    entry: { row: 30 },
    exit: { row: 50 },
    objects: [],
    solids: [
      { col: 0, cols: 18, look: "raised", row: 30, rows: 30 },
      { col: 18, cols: 12, look: "raised", row: 35, rows: 25 },
      { col: 30, cols: 12, look: "raised", row: 40, rows: 20 },
      { col: 42, cols: 12, look: "raised", row: 45, rows: 15 },
      { col: 54, cols: 18, look: "ground", row: 50, rows: 10 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "city-boundary-return-terrace": {
    cols: 60,
    difficulty: 2,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 50 },
    objects: [],
    solids: [
      { col: 0, cols: 20, look: "raised", row: 40, rows: 20 },
      { col: 20, cols: 14, look: "raised", row: 45, rows: 15 },
      { col: 34, cols: 26, look: "ground", row: 50, rows: 10 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "city-boundary-shuttle": {
    backdrops: [{ character: "facade-one-storey", col: 64, cols: 16, role: "near-wall", row: 24 }],
    cols: 96,
    difficulty: 3,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 40 },
    objects: [
      { character: "city-shuttle", col: 20, role: "shuttle", row: 40 },
      { character: "red-edge-top", col: 18, cols: 40, role: "edge-top", row: 46 },
      { character: "red-edge-support", col: 18, cols: 40, role: "support", row: 47, rows: 13 },
    ],
    solids: [
      { col: 0, cols: 18, look: "raised", row: 40, rows: 20 },
      { col: 58, cols: 38, look: "raised", row: 40, rows: 20 },
    ],
    theme: MECHANICAL_THEMES,
    weight: 2,
  },
  "city-boundary-start": {
    backdrops: [{ character: "facade-one-storey", col: 8, cols: 16, role: "near-wall", row: 34 }],
    cols: 60,
    difficulty: 1,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [],
    slots: [{ area: { col: 18, cols: 4, row: 46, rows: 4 }, id: "street-room", kind: "door" }],
    solids: [{ col: 0, cols: 60, look: "ground", row: 50, rows: 10 }],
    theme: "city-boundary",
  },
  "city-boundary-steps": {
    backdrops: [{ character: "facade-one-storey", col: 4, cols: 16, role: "near-wall", row: 34 }],
    cols: 72,
    difficulty: 2,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 40 },
    objects: [],
    solids: [
      { col: 0, cols: 20, look: "ground", row: 50, rows: 10 },
      { col: 20, cols: 6, look: "raised", row: 47, rows: 13 },
      { col: 26, cols: 6, look: "raised", row: 44, rows: 16 },
      { col: 32, cols: 6, look: "raised", row: 41, rows: 19 },
      { col: 38, cols: 34, look: "raised", row: 40, rows: 20 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "city-boundary-upper-climb": {
    backdrops: [{ character: "facade-one-storey", col: 42, cols: 12, role: "near-wall", row: 14 }],
    cols: 72,
    difficulty: 2,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 30 },
    objects: [{ character: "platform-ledge", col: 40, cols: 8, role: "ledge", row: 24 }],
    solids: [
      { col: 0, cols: 18, look: "raised", row: 40, rows: 20 },
      { col: 18, cols: 12, look: "raised", row: 35, rows: 25 },
      { col: 30, cols: 42, look: "raised", row: 30, rows: 30 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "climbing-enemy-lane": {
    backdrops: [{ character: "facade-one-storey", col: 4, cols: 12, role: "near-wall", row: 24 }],
    cols: 84,
    difficulty: 4,
    encounters: 1,
    entry: { row: 40 },
    exit: { row: 30 },
    objects: [
      { character: "platform-ledge", col: 24, cols: 6, role: "ledge", row: 35 },
      { character: "raccoon-antagonist", col: 30, role: "antagonist", row: 36 },
    ],
    solids: [
      { col: 0, cols: 34, look: "raised", row: 40, rows: 20 },
      { col: 34, cols: 50, look: "raised", row: 30, rows: 30 },
    ],
    theme: ["back-streets", "city-outskirts", "familiar-neighbourhood"],
    weight: 2,
  },
  // A gap, two full climbs and a moving red strip share one approach.
  "compound-ascent": {
    cols: 96,
    difficulty: 4,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 40 },
    objects: [
      { character: "red-edge-top", col: 18, cols: 12, role: "edge-top", row: 54 },
      { character: "red-edge-support", col: 18, cols: 12, role: "support", row: 55, rows: 5 },
      { character: "platform-ledge", col: 58, cols: 6, role: "ledge", row: 35 },
      { character: "city-ground-hazard", col: 68, role: "moving-hazard", row: 39 },
      { character: "platform-ledge", col: 86, cols: 6, role: "ledge", row: 35 },
    ],
    solids: [
      { col: 0, cols: 18, look: "ground", row: 50, rows: 10 },
      { col: 30, cols: 12, look: "ground", row: 50, rows: 10 },
      { col: 42, cols: 6, look: "raised", row: 45, rows: 15 },
      { col: 48, cols: 48, look: "raised", row: 40, rows: 20 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "compound-compact-ascent": COMPACT_HAZARD_ASCENT,
  "compound-compact-climb": {
    ...COMPACT_HAZARD_ASCENT,
    entry: COMPACT_HAZARD_ASCENT.exit,
    exit: { row: SEAM_ROWS[0] },
    objects: COMPACT_HAZARD_ASCENT.objects.map((object) => ({
      ...object,
      row: object.row - COMPACT_CLIMB_OFFSET,
    })),
    solids: COMPACT_HAZARD_ASCENT.solids.map((solid) => ({
      ...solid,
      row: solid.row - COMPACT_CLIMB_OFFSET,
      rows: solid.rows + COMPACT_CLIMB_OFFSET,
    })),
  },
  // Two independent lifts cross gaps longer or taller than an unaided jump.
  "compound-double-lift": {
    cols: 108,
    difficulty: 5,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 30 },
    objects: [
      { character: "city-lift", col: 22, role: "lift", row: 40 },
      { character: "city-lift", col: 60, role: "lift", row: 30 },
      { character: "red-edge-top", col: 18, cols: 58, role: "edge-top", row: 48 },
      { character: "red-edge-support", col: 18, cols: 58, role: "support", row: 49, rows: 11 },
    ],
    solids: [
      { col: 0, cols: 18, look: "ground", row: 40, rows: 20 },
      { col: 34, cols: 16, look: "raised", row: 30, rows: 30 },
      { col: 76, cols: 32, look: "raised", row: 30, rows: 30 },
    ],
    theme: MECHANICAL_THEMES,
  },
  // A lift feeds a raised shuttle crossing, followed by a six-tile landing climb.
  "compound-lift-shuttle": {
    cols: 120,
    difficulty: 5,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 30 },
    objects: [
      { character: "city-lift", col: 22, role: "lift", row: 50 },
      { character: "city-shuttle", col: 54, role: "shuttle", row: 36 },
      { character: "red-edge-top", col: 18, cols: 76, role: "edge-top", row: 56 },
      { character: "red-edge-support", col: 18, cols: 76, role: "support", row: 57, rows: 3 },
    ],
    solids: [
      { col: 0, cols: 18, look: "ground", row: 50, rows: 10 },
      { col: 34, cols: 12, look: "raised", row: 40, rows: 20 },
      { col: 46, cols: 4, look: "raised", row: 36, rows: 24 },
      { col: 94, cols: 26, look: "raised", row: 30, rows: 30 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "compound-low-ceiling-hazard": {
    cols: 96,
    difficulty: 4,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [
      ...TAP_CEILING_OBJECTS,
      { character: "platform-ledge", col: 48, cols: 6, role: "ledge", row: 42 },
      { character: "city-ground-hazard", col: 54, role: "moving-hazard", row: 46 },
      { character: "platform-ledge", col: 72, cols: 6, role: "ledge", row: 42 },
    ],
    solids: [
      ...TAP_CEILING_TERRAIN,
      { col: 50, cols: 34, look: "raised", row: 47, rows: 13 },
      { col: 84, cols: 12, look: "ground", row: 50, rows: 10 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "compound-low-ceiling-shuttle": {
    cols: 120,
    difficulty: 5,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [
      ...TAP_CEILING_OBJECTS,
      { character: "city-shuttle", col: 60, role: "shuttle", row: 50 },
      { character: "red-edge-top", col: 58, cols: 40, role: "edge-top", row: 56 },
      { character: "red-edge-support", col: 58, cols: 40, role: "support", row: 57, rows: 3 },
    ],
    solids: [
      ...TAP_CEILING_TERRAIN,
      { col: 50, cols: 8, look: "ground", row: 50, rows: 10 },
      { col: 98, cols: 22, look: "ground", row: 50, rows: 10 },
    ],
    theme: MECHANICAL_THEMES,
  },
  // The animal's ground lane precedes a lift, with a refuge before the red bed.
  "compound-patrol-lift": {
    cols: 120,
    difficulty: 5,
    encounters: 1,
    entry: { row: 50 },
    exit: { row: 40 },
    objects: [
      { character: "platform-ledge", col: 14, cols: 6, role: "ledge", row: 46 },
      { character: "dog-antagonist", col: 43, role: "antagonist", row: 46 },
      { character: "platform-ledge", col: 54, cols: 6, role: "ledge", row: 46 },
      { character: "city-lift", col: 72, role: "lift", row: 50 },
      { character: "red-edge-top", col: 64, cols: 20, role: "edge-top", row: 56 },
      { character: "red-edge-support", col: 64, cols: 20, role: "support", row: 57, rows: 3 },
    ],
    solids: [
      { col: 0, cols: 64, look: "ground", row: 50, rows: 10 },
      { col: 84, cols: 36, look: "raised", row: 40, rows: 20 },
    ],
    theme: PATROL_THEMES,
  },
  "compound-perch-yard": {
    cols: 120,
    difficulty: 5,
    encounters: 1,
    entry: { row: 40 },
    exit: { row: 30 },
    objects: [
      { character: "platform-ledge", col: 34, cols: 6, role: "ledge", row: 35 },
      { character: "pigeon-antagonist", col: 46, role: "antagonist", row: 26 },
      { character: "platform-ledge", col: 68, cols: 6, role: "ledge", row: 35 },
      { character: "city-ground-hazard", col: 78, role: "moving-hazard", row: 39 },
      { character: "platform-ledge", col: 96, cols: 6, role: "ledge", row: 35 },
    ],
    solids: [
      { col: 0, cols: 46, look: "ground", row: 40, rows: 20 },
      { col: 46, cols: 4, look: "raised", row: 30, rows: 30 },
      { col: 50, cols: 58, look: "ground", row: 40, rows: 20 },
      { col: 108, cols: 6, look: "raised", row: 35, rows: 25 },
      { col: 114, cols: 6, look: "raised", row: 30, rows: 30 },
    ],
    theme: ["freight-terminal", "loading-yards", "warehouse-district"],
  },
  // Offset landings descend over red beds before a moving hazard on the lower floor.
  "compound-return-high": {
    cols: 120,
    difficulty: 5,
    encounters: 0,
    entry: { row: 30 },
    exit: { row: 50 },
    objects: [
      { character: "red-edge-top", col: 18, cols: 12, role: "edge-top", row: 44 },
      { character: "red-edge-support", col: 18, cols: 12, role: "support", row: 45, rows: 15 },
      { character: "red-edge-top", col: 36, cols: 12, role: "edge-top", row: 49 },
      { character: "red-edge-support", col: 36, cols: 12, role: "support", row: 50, rows: 10 },
      { character: "platform-ledge", col: 76, cols: 6, role: "ledge", row: 45 },
      { character: "city-ground-hazard", col: 86, role: "moving-hazard", row: 49 },
      { character: "platform-ledge", col: 104, cols: 6, role: "ledge", row: 45 },
    ],
    solids: [
      { col: 0, cols: 18, look: "raised", row: 30, rows: 30 },
      { col: 30, cols: 6, look: "raised", row: 35, rows: 25 },
      { col: 48, cols: 12, look: "raised", row: 40, rows: 20 },
      { col: 60, cols: 12, look: "raised", row: 45, rows: 15 },
      { col: 72, cols: 48, look: "ground", row: 50, rows: 10 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "compound-return-shuttle": {
    cols: 108,
    difficulty: 4,
    encounters: 0,
    entry: { row: 30 },
    exit: { row: 50 },
    objects: [
      { character: "city-shuttle", col: 46, role: "shuttle", row: 45 },
      { character: "red-edge-top", col: 84, cols: 6, role: "edge-top", row: 44 },
      { character: "red-edge-support", col: 84, cols: 6, role: "support", row: 45, rows: 15 },
      { character: "red-edge-top", col: 44, cols: 40, role: "edge-top", row: 53 },
      { character: "red-edge-support", col: 44, cols: 40, role: "support", row: 54, rows: 6 },
    ],
    solids: [
      { col: 0, cols: 12, look: "raised", row: 30, rows: 30 },
      { col: 12, cols: 12, look: "raised", row: 35, rows: 25 },
      { col: 24, cols: 12, look: "raised", row: 40, rows: 20 },
      { col: 36, cols: 8, look: "raised", row: 45, rows: 15 },
      { col: 90, cols: 6, look: "raised", row: 45, rows: 15 },
      { col: 96, cols: 12, look: "ground", row: 50, rows: 10 },
    ],
    theme: MECHANICAL_THEMES,
  },
  "compound-return-terrace": {
    cols: 96,
    difficulty: 4,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 50 },
    objects: [
      { character: "platform-ledge", col: 12, cols: 6, role: "ledge", row: 35 },
      { character: "city-ground-hazard", col: 22, role: "moving-hazard", row: 39 },
      { character: "platform-ledge", col: 40, cols: 6, role: "ledge", row: 35 },
      { character: "red-edge-top", col: 76, cols: 6, role: "edge-top", row: 49 },
      { character: "red-edge-support", col: 76, cols: 6, role: "support", row: 50, rows: 10 },
    ],
    solids: [
      { col: 0, cols: 54, look: "raised", row: 40, rows: 20 },
      { col: 54, cols: 12, look: "raised", row: 45, rows: 15 },
      { col: 66, cols: 10, look: "ground", row: 50, rows: 10 },
      { col: 82, cols: 14, look: "ground", row: 50, rows: 10 },
    ],
    theme: MECHANICAL_THEMES,
  },
  // A climbing animal guards the upper landing before a separate moving ground hazard.
  "compound-vertical-yard": {
    cols: 108,
    difficulty: 5,
    encounters: 1,
    entry: { row: 40 },
    exit: { row: 30 },
    objects: [
      { character: "platform-ledge", col: 24, cols: 6, role: "ledge", row: 35 },
      { character: "raccoon-antagonist", col: 30, role: "antagonist", row: 36 },
      { character: "platform-ledge", col: 52, cols: 6, role: "ledge", row: 25 },
      { character: "city-ground-hazard", col: 62, role: "moving-hazard", row: 29 },
      { character: "platform-ledge", col: 80, cols: 6, role: "ledge", row: 25 },
    ],
    solids: [
      { col: 0, cols: 34, look: "raised", row: 40, rows: 20 },
      { col: 34, cols: 74, look: "raised", row: 30, rows: 30 },
    ],
    theme: ["back-streets", "city-outskirts", "familiar-neighbourhood"],
  },
  "growl-clearing": {
    ...GROWL_FINISH,
    cols: 96,
    entry: { row: 40 },
    exit: { row: 40 },
    objects: GROWL_FINISH.objects.map((object) => ({
      ...object,
      col: object.col + GROWL_COL_OFFSET,
      row: object.row - GROWL_ROW_OFFSET,
    })),
    solids: [
      { col: 0, cols: GROWL_COL_OFFSET, look: "ground", row: 40, rows: 20 },
      ...GROWL_FINISH.solids.map((solid) => ({
        ...solid,
        col: solid.col + GROWL_COL_OFFSET,
        row: solid.row - GROWL_ROW_OFFSET,
        rows: solid.rows + GROWL_ROW_OFFSET,
      })),
      {
        col: GROWL_FINISH.cols + GROWL_COL_OFFSET,
        cols: GROWL_COL_OFFSET,
        look: "ground",
        row: 40,
        rows: 20,
      },
    ],
    theme: ["deep-woods", "forest-paths", "ravine"],
    weight: 2,
  },
  "growl-lift-clearing": {
    ...GROWL_FINISH,
    cols: 120,
    difficulty: 5,
    entry: { row: 40 },
    exit: { row: 30 },
    objects: [
      ...GROWL_FINISH.objects.map((object) => ({ ...object, row: object.row - GROWL_ROW_OFFSET })),
      { character: "city-lift", col: 72, role: "lift", row: 40 },
      { character: "red-edge-top", col: 64, cols: 20, role: "edge-top", row: 46 },
      { character: "red-edge-support", col: 64, cols: 20, role: "support", row: 47, rows: 13 },
    ],
    solids: [
      ...GROWL_FINISH.solids.map((solid) => ({
        ...solid,
        row: solid.row - GROWL_ROW_OFFSET,
        rows: solid.rows + GROWL_ROW_OFFSET,
      })),
      { col: GROWL_FINISH.cols, cols: 4, look: "ground", row: 40, rows: 20 },
      { col: 84, cols: 36, look: "raised", row: 30, rows: 30 },
    ],
    theme: ["deep-woods", "forest-paths", "ravine"],
  },
  // Difficulty 2, up from the lawn (50) to the high terrace (30): a bench (up 2), a terrace (up 4),
  // a bench on it (up 2), the bandstand's roof (up 4, 6 above its base), a step (up 4) and the
  // high terrace (up 4). An event slot on the lawn.
  "park-bandstand": {
    backdrops: [
      { character: "park-bench-frame", col: 25, role: "bench-frame", row: 48 },
      { character: "park-bench-frame", col: 30, role: "bench-frame", row: 42 },
      { character: "park-bandstand", col: 34, role: "bandstand", row: 37 },
      { character: "park-tree", col: 70, role: "tree", row: 17 },
    ],
    cols: 96,
    difficulty: 2,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 30 },
    objects: [
      { character: "park-bench", col: 25, role: "bench", row: 48 },
      { character: "park-bench", col: 30, role: "bench", row: 42 },
      { character: "park-bandstand-roof", col: 34, role: "roof-ledge", row: 38 },
    ],
    slots: [{ area: { col: 8, cols: 6, row: 44, rows: 6 }, id: "lawn", kind: "event" }],
    solids: [
      { col: 0, cols: 28, look: "ground", row: 50, rows: 10 },
      { col: 28, cols: 18, look: "raised", row: 44, rows: 16 },
      { col: 46, cols: 6, look: "raised", row: 34, rows: 26 },
      { col: 52, cols: 44, look: "raised", row: 30, rows: 30 },
    ],
    theme: "park",
  },
  // Difficulty 1, the zone's end: a lawn with a bench.
  "park-finish": {
    backdrops: [
      { character: "park-bench-frame", col: 22, role: "bench-frame", row: 48 },
      { character: "park-tree", col: 10, role: "tree", row: 37 },
      { character: "park-lamp", col: 44, role: "lamp", row: 43 },
    ],
    cols: 60,
    difficulty: 1,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [{ character: "park-bench", col: 22, role: "bench", row: 48 }],
    solids: [{ col: 0, cols: 60, look: "ground", row: 50, rows: 10 }],
    theme: "park",
  },
  // Difficulty 3, along the high terrace (30): gaps of 12 and 16, with red edges below the gaps.
  "park-high-walk": {
    backdrops: [
      { character: "park-lamp", col: 8, role: "lamp", row: 23 },
      { character: "park-tree", col: 70, role: "tree", row: 17 },
    ],
    cols: 90,
    difficulty: 3,
    encounters: 0,
    entry: { row: 30 },
    exit: { row: 30 },
    objects: [
      { character: "red-edge-top", col: 20, cols: 12, role: "edge-top", row: 34 },
      { character: "red-edge-support", col: 20, cols: 12, role: "support", row: 35, rows: 25 },
      { character: "red-edge-top", col: 46, cols: 16, role: "edge-top", row: 34 },
      { character: "red-edge-support", col: 46, cols: 16, role: "support", row: 35, rows: 25 },
    ],
    solids: [
      { col: 0, cols: 20, look: "raised", row: 30, rows: 30 },
      { col: 32, cols: 14, look: "raised", row: 30, rows: 30 },
      { col: 62, cols: 28, look: "raised", row: 30, rows: 30 },
    ],
    theme: "park",
  },
  // Difficulty 1, along the lawn (50): taps up 1, up 1, then down 1 and 1, past a bench. A door
  // slot by the far tree.
  "park-lawn": {
    backdrops: [
      { character: "park-bench-frame", col: 44, role: "bench-frame", row: 48 },
      { character: "park-tree", col: 4, role: "tree", row: 37 },
      { character: "park-lamp", col: 52, role: "lamp", row: 43 },
      { character: "park-tree", col: 62, role: "tree", row: 37 },
    ],
    cols: 72,
    difficulty: 1,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [{ character: "park-bench", col: 44, role: "bench", row: 48 }],
    slots: [{ area: { col: 56, cols: 4, row: 45, rows: 5 }, id: "by-the-tree", kind: "door" }],
    solids: [
      { col: 0, cols: 20, look: "ground", row: 50, rows: 10 },
      { col: 20, cols: 6, look: "raised", row: 49, rows: 11 },
      { col: 26, cols: 6, look: "raised", row: 48, rows: 12 },
      { col: 32, cols: 8, look: "raised", row: 49, rows: 11 },
      { col: 40, cols: 32, look: "ground", row: 50, rows: 10 },
    ],
    theme: "park",
  },
  // A short press clears the one-tile step beneath the red ceiling; a full jump hits it.
  // The overhead block is eleven tiles above the lawn, beyond the full jump's reach.
  "park-low-ceiling": {
    cols: 72,
    difficulty: 3,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [
      { character: "red-edge-bottom", col: 20, cols: 18, role: "edge-bottom", row: 41 },
      { character: "red-edge-left", col: 19, role: "edge-left", row: 39, rows: 2 },
      { character: "red-edge-right", col: 38, role: "edge-right", row: 39, rows: 2 },
      { character: "red-edge-top", col: 20, cols: 18, role: "edge-top", row: 38 },
      { character: "red-edge-support", col: 20, cols: 18, role: "support", row: 39, rows: 2 },
    ],
    solids: [
      { col: 0, cols: 26, look: "ground", row: 50, rows: 10 },
      { col: 26, cols: 6, look: "raised", row: 49, rows: 11 },
      { col: 32, cols: 40, look: "ground", row: 50, rows: 10 },
    ],
    theme: "park",
  },
  // Difficulty 3, across the pond on the middle terrace (40): the banks are 40 apart, so she rides
  // a boat that crosses between them, 2 from each bank. A door slot on the far bank.
  "park-pond": {
    backdrops: [{ character: "park-tree", col: 84, role: "tree", row: 27 }],
    cols: 100,
    difficulty: 3,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 40 },
    noCross: [{ from: { col: 10, row: 40 }, to: { col: 80, row: 40 } }],
    objects: [
      { character: "red-edge-top", col: 20, cols: 40, role: "edge-top", row: 45 },
      { character: "red-edge-support", col: 20, cols: 40, role: "support", row: 46, rows: 14 },
      {
        character: "park-boat",
        col: 22,
        phase: 0,
        role: "shuttle",
        row: 40,
      },
    ],
    slots: [{ area: { col: 80, cols: 4, row: 35, rows: 5 }, id: "far-bank", kind: "door" }],
    solids: [
      { col: 0, cols: 20, look: "raised", row: 40, rows: 20 },
      { col: 60, cols: 40, look: "raised", row: 40, rows: 20 },
    ],
    theme: "park",
  },
  // Difficulty 2, down from the high terrace (30) to the lawn (50) in drops of 6, 7 and 7, then a
  // red edge to jump.
  "park-slope-down": {
    backdrops: [{ character: "park-lamp", col: 24, role: "lamp", row: 29 }],
    cols: 80,
    difficulty: 2,
    encounters: 0,
    entry: { row: 30 },
    exit: { row: 50 },
    objects: [
      { character: "red-edge-top", col: 60, cols: 3, role: "edge-top", row: 49 },
      { character: "red-edge-support", col: 60, cols: 3, role: "support", row: 50, rows: 10 },
    ],
    solids: [
      { col: 0, cols: 20, look: "raised", row: 30, rows: 30 },
      { col: 20, cols: 14, look: "raised", row: 36, rows: 24 },
      { col: 34, cols: 14, look: "raised", row: 43, rows: 17 },
      { col: 48, cols: 12, look: "ground", row: 50, rows: 10 },
      { col: 63, cols: 17, look: "ground", row: 50, rows: 10 },
    ],
    theme: "park",
  },
  // Difficulty 1, the zone's start: a lawn (50) with a tap up 1 and down, a bench, and an event
  // slot.
  "park-start": {
    backdrops: [
      { character: "park-bench-frame", col: 40, role: "bench-frame", row: 48 },
      { character: "park-tree", col: 6, role: "tree", row: 37 },
      { character: "park-lamp", col: 20, role: "lamp", row: 43 },
    ],
    cols: 60,
    difficulty: 1,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 50 },
    objects: [{ character: "park-bench", col: 40, role: "bench", row: 48 }],
    slots: [{ area: { col: 46, cols: 6, row: 44, rows: 6 }, id: "lawn", kind: "event" }],
    solids: [
      { col: 0, cols: 24, look: "ground", row: 50, rows: 10 },
      { col: 24, cols: 8, look: "raised", row: 49, rows: 11 },
      { col: 32, cols: 28, look: "ground", row: 50, rows: 10 },
    ],
    theme: "park",
  },
  // Difficulty 2, down from the high terrace (30) to the middle terrace (40), then two red
  // edges to jump.
  "park-steps-down": {
    backdrops: [{ character: "park-tree", col: 4, role: "tree", row: 17 }],
    cols: 70,
    difficulty: 2,
    encounters: 0,
    entry: { row: 30 },
    exit: { row: 40 },
    objects: [
      { character: "red-edge-top", col: 36, cols: 3, role: "edge-top", row: 39 },
      { character: "red-edge-support", col: 36, cols: 3, role: "support", row: 40, rows: 20 },
      { character: "red-edge-top", col: 52, cols: 2, role: "edge-top", row: 39 },
      { character: "red-edge-support", col: 52, cols: 2, role: "support", row: 40, rows: 20 },
    ],
    solids: [
      { col: 0, cols: 22, look: "raised", row: 30, rows: 30 },
      { col: 22, cols: 14, look: "raised", row: 40, rows: 20 },
      { col: 39, cols: 13, look: "raised", row: 40, rows: 20 },
      { col: 54, cols: 16, look: "raised", row: 40, rows: 20 },
    ],
    theme: "park",
  },
  // Difficulty 1, down from the middle terrace (40) to the lawn (50) in two steps of 5. An event
  // slot on the lawn.
  "park-terrace-down": {
    backdrops: [
      { character: "park-bench-frame", col: 36, role: "bench-frame", row: 48 },
      { character: "park-tree", col: 50, role: "tree", row: 37 },
    ],
    cols: 64,
    difficulty: 1,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 50 },
    objects: [{ character: "park-bench", col: 36, role: "bench", row: 48 }],
    slots: [{ area: { col: 40, cols: 6, row: 44, rows: 6 }, id: "lawn", kind: "event" }],
    solids: [
      { col: 0, cols: 20, look: "raised", row: 40, rows: 20 },
      { col: 20, cols: 12, look: "raised", row: 45, rows: 15 },
      { col: 32, cols: 32, look: "ground", row: 50, rows: 10 },
    ],
    theme: "park",
  },
  // Difficulty 2, up from the lawn (50) to the middle terrace (40): a red edge to jump, then
  // two rises of 5.
  "park-terrace-up": {
    backdrops: [
      { character: "park-bench-frame", col: 50, role: "bench-frame", row: 38 },
      { character: "park-tree", col: 60, role: "tree", row: 27 },
    ],
    cols: 80,
    difficulty: 2,
    encounters: 0,
    entry: { row: 50 },
    exit: { row: 40 },
    objects: [
      { character: "red-edge-top", col: 12, cols: 3, role: "edge-top", row: 49 },
      { character: "red-edge-support", col: 12, cols: 3, role: "support", row: 50, rows: 10 },
      { character: "park-bench", col: 50, role: "bench", row: 38 },
    ],
    solids: [
      { col: 0, cols: 12, look: "ground", row: 50, rows: 10 },
      { col: 15, cols: 9, look: "ground", row: 50, rows: 10 },
      { col: 24, cols: 16, look: "raised", row: 45, rows: 15 },
      { col: 40, cols: 40, look: "raised", row: 40, rows: 20 },
    ],
    theme: "park",
  },
  // Difficulty 2, up from the middle terrace (40) to the high terrace (30): a red edge to jump,
  // then two rises of 5. A tree's branch over the high terrace, 6 up, for a look out.
  "park-upper-terrace": {
    backdrops: [{ character: "park-tree", col: 46, role: "tree", row: 17 }],
    cols: 80,
    difficulty: 2,
    encounters: 0,
    entry: { row: 40 },
    exit: { row: 30 },
    objects: [
      { character: "red-edge-top", col: 12, cols: 3, role: "edge-top", row: 39 },
      { character: "red-edge-support", col: 12, cols: 3, role: "support", row: 40, rows: 20 },
      { character: "park-branch", col: 48, role: "branch", row: 24 },
    ],
    solids: [
      { col: 0, cols: 12, look: "raised", row: 40, rows: 20 },
      { col: 15, cols: 11, look: "raised", row: 40, rows: 20 },
      { col: 26, cols: 10, look: "raised", row: 35, rows: 25 },
      { col: 36, cols: 44, look: "raised", row: 30, rows: 30 },
    ],
    theme: "park",
  },
  ...APARTMENT_CHUNKS,
  ...COUNTRYSIDE_CHUNKS,
  ...HOME_CITY_CHUNKS,
  ...INDUSTRIAL_CHUNKS,
  ...STREET_CHUNKS,
  ...WOODLAND_CHUNKS,
};
