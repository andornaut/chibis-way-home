// Trixi's arena: River crossing. Trixi rushes along the ground she stands on and sets her traps
// there, so the arena raises its high ground above her lanes.
import type { ChunkArena, TerrainRect } from "../types";

const ROWS = 120;
const BANK = 80;

const ground = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});
const timber = (col: number, cols: number, row: number, rows: number): TerrainRect => ({
  col,
  cols,
  look: "raised",
  row,
  rows,
});

// River crossing: a one-way deck spans most of the bank, seven rows up. A timber step and a
// one-way bridge rise to its near end in two-row steps, each wide enough for Trixi to stand on.
// She starts on the far bank beyond the step, rushes and sets traps along the bank
// and the deck. Both actors can jump onto the ledges from below. The loop runs under the deck
// and back over it.
const RIVER_CROSSING: ChunkArena = {
  boss: "goose-antagonist",
  difficulty: 5,
  entry: { row: BANK },
  exit: { row: BANK },
  id: "arena-goose-river-crossing",
  objects: [
    { character: "goose-antagonist", col: 50, role: "antagonist", row: 76 },
    { character: "platform-ledge", col: 14, cols: 30, role: "ledge", row: 73 },
    { character: "platform-ledge", col: 11, cols: 5, role: "ledge", row: 75 },
  ],
  refuges: [{ at: { col: 18, row: 73 }, kind: "high-ground", width: 20 }],
  route: {},
  routes: [
    {
      id: "bank",
      waypoints: [
        { col: 2, row: BANK },
        { col: 28, row: BANK },
        { col: 46, row: 74 },
        { col: 57, row: BANK },
      ],
    },
    {
      id: "loop",
      waypoints: [
        { col: 13, row: BANK },
        { col: 28, row: BANK },
        { col: 41, row: BANK },
        { col: 46, row: 74 },
        { col: 40, row: 73 },
        { col: 18, row: 73 },
        { col: 13, row: 75 },
        { col: 8, row: 77 },
        { col: 13, row: BANK },
      ],
    },
  ],
  solids: [ground(0, 60, BANK), timber(6, 5, 77, 3), timber(44, 5, 74, 6)],
  stage: "river-crossing",
};

export const TRIXI_ARENAS: readonly ChunkArena[] = [RIVER_CROSSING];
