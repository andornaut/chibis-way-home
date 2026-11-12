// Fert's arenas, Apartment building: a hall under a high gallery reached by staggered landings.
// The gallery is solid, so it shields the floor below it from parcels thrown from above.
import type { ChunkArena, Instance, TerrainRect } from "../types/index.ts";

const ROWS = 120;
const FLOOR = 50;
const RUNG = 6;
const GALLERY = FLOOR - 3 * RUNG;
const LANDING = FLOOR - 2 * RUNG;

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
// Two staggered landings from the floor up to the gallery, the inner one `cols` wide.
const landings = (inner: number, outer: number, cols = 6) => [
  slab(inner, cols, FLOOR - RUNG),
  slab(outer, 6, FLOOR - 2 * RUNG),
];
// A one-way step at the inner landing's height under the left outer landing, clear of the entry
// seam: a second way up and down by the entry, away from the inner landing.
const BACK_STEP: Instance = {
  character: "platform-ledge",
  col: 4,
  cols: 6,
  role: "ledge",
  row: FLOOR - RUNG,
};
// The ring: along the floor, up the right landings, back along the gallery, down the left by the
// step at `descent`.
const ring = (left: number, right: number, descent = left) => [
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
  { col: descent, row: FLOOR - RUNG },
  { col: left, row: FLOOR },
];

// Residential floors: a wide hall with a clear floor under one long gallery. On the left the inner
// landing is wide enough to catch Chibi as he steps off the outer one at a run; on the right the
// inner landing lies beyond the outer one, so climbing to the gallery from the floor turns back on
// itself while the gallery leads straight down to the exit. A cabinet hung under the middle of the
// gallery, ten rows above the floor, stops Fert leaping across the hall. The loop comes down by
// the step under the left outer landing, away from Fert's run along the floor.
export const RESIDENTIAL_FLOORS: ChunkArena = {
  boss: "ferret-antagonist",
  difficulty: 4,
  entry: { row: FLOOR },
  exit: { row: FLOOR },
  id: "arena-ferret-residential-floors",
  objects: [
    BACK_STEP,
    { character: "ferret-antagonist", col: 48, role: "antagonist", row: FLOOR - 4 },
  ],
  refuges: [{ at: { col: 28, row: FLOOR }, kind: "cover", width: 6 }],
  route: {},
  routes: [
    {
      id: "loop",
      waypoints: [
        { col: 17, row: FLOOR },
        { col: 24, row: FLOOR },
        { col: 36, row: FLOOR },
        { col: 47, row: FLOOR },
        { col: 52, row: FLOOR - RUNG },
        { col: 46, row: LANDING },
        { col: 40, row: GALLERY },
        { col: 36, row: GALLERY },
        { col: 24, row: GALLERY },
        { col: 17, row: GALLERY },
        { col: 11, row: LANDING },
        { col: 6, row: FLOOR - RUNG },
        { col: 17, row: FLOOR },
      ],
    },
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
    slab(14, 30, GALLERY),
    slab(28, 4, GALLERY, 8),
    ...landings(14, 8, 10),
    ...landings(50, 44),
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

// Penthouse: a tighter hall under a gallery split by a gap Chibi jumps, a red pit by the entry and
// a wall before the exit that Chibi crosses from the upper landing. Fert starts on the far gallery,
// above the way to the exit, so Chibi draws him off it before he climbs out. The loop comes down
// by the step under the left outer landing, away from Fert's run along the floor.
export const PENTHOUSE: ChunkArena = {
  boss: "ferret-antagonist",
  difficulty: 5,
  entry: { row: FLOOR },
  exit: { row: FLOOR },
  id: "arena-ferret-penthouse",
  objects: [
    BACK_STEP,
    ...pit(4, 4),
    { character: "ferret-antagonist", col: 36, role: "antagonist", row: GALLERY - 4 },
  ],
  refuges: [{ at: { col: 32, row: FLOOR }, kind: "cover", width: 4 }],
  route: {},
  routes: [
    { id: "loop", waypoints: ring(17, 41, 6) },
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
  ],
  stage: "penthouse",
};

export const FERT_ARENAS: readonly ChunkArena[] = [PENTHOUSE, RESIDENTIAL_FLOORS];
