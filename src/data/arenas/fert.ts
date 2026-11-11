// Fert's arenas, Apartment building: a hall under a high gallery reached by staggered landings,
// furnished with solid posts four rows tall, above his parcel arc, that stop his parcels.
import type { ChunkArena, TerrainRect } from "../types";

const ROWS = 120;
const FLOOR = 50;
const RUNG = 6;
const GALLERY = FLOOR - 3 * RUNG;
const LANDING = FLOOR - 2 * RUNG;
const COVER_ROWS = 4;

const ground = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});
const slab = (col: number, cols: number, row: number, rows = 1): TerrainRect => ({
  col,
  cols,
  look: "raised",
  row,
  rows,
});
// A solid post, a coat stand or lamp, standing on the surface at `row`.
const post = (col: number, row: number) => slab(col, 1, row - COVER_ROWS, COVER_ROWS);
// Two staggered landings from the floor up to the gallery.
const landings = (inner: number, outer: number) => [
  slab(inner, 6, FLOOR - RUNG),
  slab(outer, 6, FLOOR - 2 * RUNG),
];
// The ring: along the floor, up the right landings, back along the gallery, down the left.
const ring = (left: number, right: number) => [
  { col: left, row: FLOOR },
  { col: 24, row: FLOOR },
  { col: 36, row: FLOOR },
  { col: right, row: FLOOR },
  { col: right, row: FLOOR - RUNG },
  { col: right + 6, row: FLOOR - 2 * RUNG },
  { col: right, row: GALLERY },
  { col: 36, row: GALLERY },
  { col: 24, row: GALLERY },
  { col: left, row: GALLERY },
  { col: left - 6, row: FLOOR - 2 * RUNG },
  { col: left, row: FLOOR - RUNG },
  { col: left, row: FLOOR },
];

// Residential floors: a wide hall with a pair of posts on the floor that shield the space
// between them from either side.
export const RESIDENTIAL_FLOORS: ChunkArena = {
  boss: "ferret-antagonist",
  difficulty: 4,
  entry: { row: FLOOR },
  exit: { row: FLOOR },
  id: "arena-ferret-residential-floors",
  objects: [{ character: "ferret-antagonist", col: 48, role: "antagonist", row: FLOOR - 4 }],
  refuges: [{ at: { col: 28, row: FLOOR }, kind: "cover", width: 6 }],
  route: {},
  routes: [
    { id: "loop", waypoints: ring(17, 43) },
    {
      id: "hall",
      waypoints: [
        { col: 4, row: FLOOR },
        { col: 56, row: FLOOR },
      ],
    },
  ],
  solids: [
    ground(0, 60, FLOOR),
    slab(14, 32, GALLERY),
    ...landings(14, 8),
    ...landings(40, 46),
    post(27, FLOOR),
    post(35, FLOOR),
  ],
  stage: "residential-floors",
};

// A red pit `cols` wide in the floor, its hazard top seven rows down.
const pit = (col: number, cols: number) => [
  { character: "red-edge-top", col, cols, role: "edge-top", row: FLOOR + 6 },
  {
    character: "red-edge-support",
    col,
    cols,
    role: "support",
    row: FLOOR + 7,
    rows: ROWS - FLOOR - 7,
  },
];

// Penthouse: a tighter hall under a shorter gallery, a narrower pair of posts, a red pit by the
// entry and a wall before the exit that Chibi crosses from the upper landing.
export const PENTHOUSE: ChunkArena = {
  boss: "ferret-antagonist",
  difficulty: 5,
  entry: { row: FLOOR },
  exit: { row: FLOOR },
  id: "arena-ferret-penthouse",
  objects: [
    ...pit(4, 4),
    { character: "ferret-antagonist", col: 44, role: "antagonist", row: FLOOR - 4 },
  ],
  refuges: [{ at: { col: 27, row: FLOOR }, kind: "cover", width: 5 }],
  route: {},
  routes: [
    { id: "loop", waypoints: ring(17, 41) },
    {
      id: "hall",
      waypoints: [
        { col: 10, row: FLOOR },
        { col: 53, row: LANDING },
      ],
    },
  ],
  solids: [
    ground(0, 4, FLOOR),
    ground(8, 52, FLOOR),
    slab(50, 6, LANDING, FLOOR - LANDING),
    slab(16, 10, GALLERY),
    slab(32, 12, GALLERY),
    ...landings(14, 8),
    ...landings(38, 44),
    post(26, FLOOR),
    post(33, FLOOR),
  ],
  stage: "penthouse",
};

export const FERT_ARENAS: readonly ChunkArena[] = [PENTHOUSE, RESIDENTIAL_FLOORS];
