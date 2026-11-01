import {
  BOUNDARY_START,
  CHUNK_COLS,
  GROWL_FINISH,
  PATROL_ENCOUNTER,
  withoutEncounters,
} from "./chunkTemplates";
import { ZONE_ROWS } from "./screen";
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
const shuttle = (col: number, row: number): Instance => ({
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
const roof = (col: number, cols: number, underside: number): readonly Instance[] => [
  { character: "red-edge-bottom", col, cols, role: "edge-bottom", row: underside },
  { character: "red-edge-left", col: col - 1, role: "edge-left", row: underside - 2, rows: 2 },
  { character: "red-edge-right", col: col + cols, role: "edge-right", row: underside - 2, rows: 2 },
  { character: "red-edge-top", col, cols, role: "edge-top", row: underside - 3 },
  { character: "red-edge-support", col, cols, role: "support", row: underside - 2, rows: 2 },
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
const FLYER_ASCENT = moduleChunk(
  ["freight-terminal", "loading-yards", "warehouse-district"],
  4,
  40,
  30,
  [floor(0, 24, 40), floor(24, 4, 30), floor(28, 16, 40), floor(44, 6, 35), floor(50, 10, 30)],
  [
    { character: "red-edge-support", col: 12, cols: 6, role: "support", row: 34, rows: 1 },
    { character: "pigeon-antagonist", col: 24, role: "antagonist", row: 26 },
    ledge(38, 6, 35),
  ],
);
const VERTICAL_ASCENT = moduleChunk(
  ["back-streets", "city-outskirts", "familiar-neighbourhood"],
  4,
  40,
  30,
  [floor(0, 28, 40), floor(28, 16, 30), floor(44, 4, 27), floor(48, 12, 30)],
  [ledge(18, 6, 35), { character: "raccoon-antagonist", col: 24, role: "antagonist", row: 36 }],
);
const PATROL_LIFT = moduleChunk(
  PATROL_THEMES,
  5,
  50,
  40,
  [floor(0, 4, 50), floor(4, 4, 44), floor(8, 22, 50), floor(30, 4, 44), floor(50, 10, 40)],
  [
    { character: "dog-antagonist", col: 25, role: "antagonist", row: 46 },
    lift(38, 50),
    ...red(34, 16, 57),
  ],
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

// Every horizontal module occupies one screen. Moving tracks and lethal strips stay between seam footings.
function horizontalYard(bear: boolean, origin: number): ChunkPlan {
  const left = origin - 22;
  const right = origin + 6;
  return moduleChunk(
    bear ? ["deep-woods", "forest-paths", "ravine"] : PATROL_THEMES,
    4,
    50,
    50,
    [
      floor(0, left, 50),
      floor(left, 4, 44),
      floor(left + 4, right - left - 4 - (bear ? 2 : 0), 50),
      floor(right, 4, 44),
      floor(right + 4, CHUNK_COLS - right - 4, 50),
    ],
    [
      {
        character: bear ? "bear-antagonist" : "dog-antagonist",
        col: origin,
        role: "antagonist",
        row: 46,
      },
      ledge(left + 4, 6, 44),
      ledge(right - 6, 6, 44),
      ...(bear ? red(right - 2, 2, 50) : []),
    ],
  );
}
function flyerYard(origin: number): ChunkPlan {
  return moduleChunk(
    ["freight-terminal", "loading-yards", "warehouse-district"],
    4,
    50,
    50,
    [
      floor(0, origin, 50),
      floor(origin, 4, 40),
      floor(origin + 4, 48 - origin - 4, 50),
      floor(48, 4, 47),
      floor(52, 8, 50),
    ],
    [
      { character: "pigeon-antagonist", col: origin, role: "antagonist", row: 36 },
      {
        character: "red-edge-support",
        col: origin - 12,
        cols: 6,
        role: "support",
        row: 44,
        rows: 1,
      },
      ledge(origin + 6, 6, 45),
    ],
  );
}
function verticalYard(origin: number): ChunkPlan {
  return moduleChunk(
    ["back-streets", "city-outskirts", "familiar-neighbourhood"],
    4,
    50,
    50,
    [
      floor(0, origin + 4, 50),
      floor(origin + 4, 8, 40),
      floor(origin + 12, 6, 45),
      floor(origin + 18, CHUNK_COLS - origin - 18, 50),
    ],
    [
      ledge(origin - 6, 6, 45),
      { character: "raccoon-antagonist", col: origin, role: "antagonist", row: 46 },
    ],
  );
}
const ENCOUNTER_YARDS: Readonly<Record<string, ChunkPlan>> = Object.fromEntries(
  ["early", "middle", "late"].flatMap((position, index) => [
    [`patrol-cover-${position}`, horizontalYard(false, 26 + index * 8)],
    [`growl-cover-${position}`, horizontalYard(true, 26 + index * 8)],
    [`flyer-shelter-${position}`, flyerYard(18 + index * 10)],
    [`vertical-stack-${position}`, verticalYard(20 + index * 8)],
  ]),
);

export const CHUNKS: Readonly<Record<string, ChunkPlan>> = {
  ...ENCOUNTER_YARDS,
  "bounded-flyer-post": FLYER_ASCENT,
  "city-boundary-climb-yard": moduleChunk(
    PATROL_THEMES,
    4,
    50,
    40,
    [
      floor(0, 8, 50),
      floor(8, 4, 45),
      floor(12, 8, 40),
      floor(20, 4, 34),
      floor(24, 24, 40),
      floor(48, 4, 34),
      floor(52, 8, 40),
    ],
    [
      ledge(14, 6, 34),
      { character: "dog-antagonist", col: 42, role: "antagonist", row: 36 },
      ledge(52, 4, 34),
    ],
  ),
  "city-boundary-dog-high": { ...shifted(-20, PATROL_ENCOUNTER), theme: PATROL_THEMES, weight: 2 },
  "city-boundary-dog-terrace": {
    ...shifted(-10, PATROL_ENCOUNTER),
    theme: PATROL_THEMES,
    weight: 2,
  },
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
    [ledge(18, 6, 34), mover(24, 39), ledge(38, 4, 34), ...roof(42, 8, 33)],
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
    roof(16, 14, 42),
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
    [floor(0, 8, 40), floor(46, 14, 40)],
    [shuttle(10, 40), ...red(8, 38, 47)],
  ),
  "city-boundary-start": { ...BOUNDARY_START, theme: "city-boundary" },
  "city-boundary-steps": moduleChunk(
    MECHANICAL_THEMES,
    3,
    50,
    40,
    [
      floor(0, 8, 50),
      floor(8, 8, 47),
      floor(16, 8, 44),
      floor(24, 8, 41),
      floor(32, 12, 40),
      floor(44, 4, 37),
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
  "climbing-enemy-lane": VERTICAL_ASCENT,
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
    [floor(0, 8, 50), floor(22, 6, 40), floor(28, 4, 36), floor(56, 4, 30)],
    [lift(10, 50), shuttle(20, 36), ...red(8, 48, 57)],
  ),
  "compound-low-ceiling-hazard": moduleChunk(MECHANICAL_THEMES, 4, 50, 50, TAP_TERRAIN, [
    ...roof(12, 16, 40),
    ledge(28, 4, 41),
    mover(32, 46),
    ledge(48, 6, 41),
  ]),
  "compound-low-ceiling-shuttle": moduleChunk(
    MECHANICAL_THEMES,
    5,
    50,
    50,
    [floor(0, 4, 50), floor(4, 4, 47), floor(8, 4, 46), floor(12, 6, 47), floor(54, 6, 50)],
    [...roof(5, 12, 40), shuttle(18, 47), ...red(18, 36, 57)],
  ),
  "compound-patrol-lift": PATROL_LIFT,
  "compound-perch-yard": {
    ...FLYER_ASCENT,
    difficulty: 5,
    objects: [...FLYER_ASCENT.objects, ...red(32, 4, 40)],
    solids: [
      floor(0, 24, 40),
      floor(24, 4, 30),
      floor(28, 4, 40),
      floor(36, 8, 40),
      floor(44, 6, 35),
      floor(50, 10, 30),
    ],
  },
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
    [floor(0, 8, 30), floor(8, 8, 35), floor(16, 8, 40), floor(24, 4, 45), floor(56, 4, 50)],
    [shuttle(20, 45), ...red(28, 28, 54)],
  ),
  "compound-return-terrace": moduleChunk(
    MECHANICAL_THEMES,
    4,
    40,
    50,
    [floor(0, 36, 40), floor(36, 8, 45), floor(44, 4, 50), floor(52, 8, 50)],
    [ledge(8, 6, 34), mover(16, 39), ledge(30, 6, 34), ...red(48, 4, 50)],
  ),
  "compound-vertical-yard": {
    ...VERTICAL_ASCENT,
    difficulty: 5,
    objects: [...VERTICAL_ASCENT.objects, ...red(44, 4, 30), ...roof(40, 12, 22)],
    solids: [floor(0, 28, 40), floor(28, 16, 30), floor(48, 12, 30)],
  },
  "growl-clearing": {
    ...shifted(-10, GROWL_FINISH),
    encounters: 1,
    objects: [
      ...shifted(-10, GROWL_FINISH).objects,
      { character: "bear-antagonist", col: 38, role: "antagonist", row: 36 },
    ],
    theme: ["deep-woods", "forest-paths", "ravine"],
    weight: 2,
  },
  "growl-lift-clearing": {
    ...shifted(-10, PATROL_LIFT),
    theme: ["deep-woods", "forest-paths", "ravine"],
  },
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
    roof(20, 18, 41),
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
  ...APARTMENT_CHUNKS,
  ...COUNTRYSIDE_CHUNKS,
  ...HOME_CITY_CHUNKS,
  ...INDUSTRIAL_CHUNKS,
  ...STREET_CHUNKS,
  ...WOODLAND_CHUNKS,
};
