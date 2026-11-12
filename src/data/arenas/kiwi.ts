// Kiwi's arena, Home city: a street under a high footbridge, with fire-escape landings at both
// ends. The bridge, its deep middle span and the landings are low ceilings she cannot climb past,
// so Chibi beneath one blocks her climb and drop; none of them is a perch inside the loop.
import type { ChunkArena, TerrainRect } from "../types/index.ts";

const ROWS = 120;
const FLOOR = 80;
const RUNG = 6;
const BRIDGE = FLOOR - 3 * RUNG;
const SPAN = FLOOR - 8;

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
// A fire escape: two staggered solid landings up to the footbridge.
const fireEscape = (inner: number, outer: number) => [
  slab(inner, 6, FLOOR - RUNG),
  slab(outer, 6, FLOOR - 2 * RUNG),
];

// Familiar neighbourhood: a ring along the street and back over the footbridge.
export const FAMILIAR_NEIGHBOURHOOD: ChunkArena = {
  boss: "raccoon-antagonist",
  difficulty: 5,
  entry: { row: FLOOR },
  exit: { row: FLOOR },
  id: "arena-raccoon-familiar-neighbourhood",
  objects: [{ character: "raccoon-antagonist", col: 48, role: "antagonist", row: FLOOR - 4 }],
  refuges: [
    { at: { col: 14, row: FLOOR - RUNG }, kind: "low-ceiling", width: 4 },
    { at: { col: 25, row: FLOOR }, kind: "low-ceiling", width: 4 },
    { at: { col: 40, row: FLOOR - RUNG }, kind: "low-ceiling", width: 4 },
  ],
  route: {},
  routes: [
    {
      id: "loop",
      waypoints: [
        { col: 17, row: FLOOR },
        { col: 24, row: FLOOR },
        { col: 30, row: FLOOR },
        { col: 36, row: FLOOR },
        { col: 43, row: FLOOR },
        { col: 43, row: FLOOR - RUNG },
        { col: 49, row: FLOOR - 2 * RUNG },
        { col: 43, row: BRIDGE },
        { col: 36, row: BRIDGE },
        { col: 30, row: BRIDGE },
        { col: 24, row: BRIDGE },
        { col: 17, row: BRIDGE },
        { col: 11, row: FLOOR - 2 * RUNG },
        { col: 17, row: FLOOR - RUNG },
        { col: 17, row: FLOOR },
      ],
    },
    {
      id: "bridge",
      waypoints: [
        { col: 20, row: BRIDGE },
        { col: 27, row: BRIDGE },
        { col: 33, row: BRIDGE },
        { col: 40, row: BRIDGE },
      ],
    },
    {
      id: "street",
      waypoints: [
        { col: 4, row: FLOOR },
        { col: 56, row: FLOOR },
      ],
    },
  ],
  solids: [
    ground(0, 60, FLOOR),
    slab(14, 32, BRIDGE),
    ...fireEscape(14, 8),
    ...fireEscape(40, 46),
    slab(24, 12, BRIDGE, SPAN - BRIDGE),
  ],
  stage: "familiar-neighbourhood",
};

export const KIWI_ARENAS: readonly ChunkArena[] = [FAMILIAR_NEIGHBOURHOOD];
