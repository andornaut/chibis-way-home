// Bini's arena: Ravine. Bini growls, charges and mauls along the level he stands on, so the arena
// raises its high ground above his lanes.
import type { ChunkArena, Instance, TerrainRect } from "../types/index.ts";

const ROWS = 120;
const RIM = 80;

const ground = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});
const stack = (col: number, cols: number, row: number, rows: number): TerrainRect => ({
  col,
  cols,
  look: "raised",
  row,
  rows,
});
const ledge = (col: number, cols: number, row: number): Instance => ({
  character: "platform-ledge",
  col,
  cols,
  role: "ledge",
  row,
});
const red = (col: number, cols: number, row: number): readonly Instance[] => [
  { character: "red-edge-top", col, cols, role: "edge-top", row: row - 1 },
  { character: "red-edge-support", col, cols, role: "support", row, rows: ROWS - row },
];

// Ravine: on the near rim a one-way deck, and under its middle the one nook, the first and
// clearest refuge: a stone step whose roof, a solid stretch of the deck, lies three rows up,
// Chibi's shelter from the growl. Then a plank over a red-floored cut, and on the far rim, where
// Bini waits, a stone stack below a ledge, the only high ground there. The loop circles the deck.
const RAVINE: ChunkArena = {
  boss: "bear-antagonist",
  difficulty: 5,
  entry: { row: RIM },
  exit: { row: RIM },
  id: "arena-bear-ravine",
  objects: [
    ledge(6, 7, 74),
    ledge(25, 7, 74),
    ledge(34, 8, RIM),
    ...red(34, 8, 90),
    { character: "bear-antagonist", col: 52, role: "antagonist", row: 76 },
  ],
  refuges: [{ at: { col: 17, row: 78 }, kind: "high-ground", width: 3 }],
  route: {},
  routes: [
    {
      id: "loop",
      waypoints: [
        { col: 10, row: RIM },
        { col: 28, row: RIM },
        { col: 28, row: 74 },
        { col: 19, row: 74 },
        { col: 9, row: 74 },
        { col: 10, row: RIM },
      ],
    },
    {
      id: "nook",
      waypoints: [
        { col: 10, row: RIM },
        { col: 18, row: 78 },
      ],
    },
    {
      id: "rim",
      waypoints: [
        { col: 4, row: RIM },
        { col: 30, row: RIM },
        { col: 38, row: RIM },
        { col: 56, row: RIM },
      ],
    },
  ],
  solids: [
    ground(0, 34, RIM),
    ground(34, 8, 90),
    ground(42, 18, RIM),
    stack(14, 10, 78, 2),
    stack(16, 6, 74, 1),
    stack(46, 4, 77, 3),
  ],
  stage: "ravine",
};

export const BINI_ARENAS: readonly ChunkArena[] = [RAVINE];
