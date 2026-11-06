// One sample arena per boss for the arena tests, outside the game's pool: a floor on the seam row,
// a one-way deck six rows up that closes the loop, and near the entry a nook every boss is too tall
// to enter: a two-row step under a roof three rows above it, Chibi's height. It is high ground
// against charges, cover against parcels and droppings, and a low ceiling against Kiwi.
import type { AntagonistKind, ChunkArena, RefugeKind, SeamRow, TerrainRect } from "../data/types";

const ROWS = 120;
const DECK = { col: 20, cols: 34, rise: 6 } as const;
// The nook's step and its roof, which leaves `open` columns of the step clear at each end to
// climb in.
const NOOK = { col: 6, cols: 10, open: 2 } as const;

const ground = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});
const slab = (col: number, cols: number, row: number, rows: number): TerrainRect => ({
  col,
  cols,
  look: "raised",
  row,
  rows,
});

interface Sample {
  readonly boss: AntagonistKind;
  readonly kind: RefugeKind;
  readonly row: SeamRow;
  readonly stage: string;
}

function sample({ boss, kind, row, stage }: Sample): ChunkArena {
  const deck = row - DECK.rise;
  const left = DECK.col + 2;
  const right = DECK.col + DECK.cols - 2;
  const middle = DECK.col + DECK.cols / 2;
  const step = row - 2;
  const inside = NOOK.col + NOOK.open + 1;
  return {
    boss,
    difficulty: 4,
    entry: { row },
    exit: { row },
    id: `arena-${boss.replace("-antagonist", "")}-sample`,
    objects: [
      { character: "platform-ledge", col: DECK.col, cols: DECK.cols, role: "ledge", row: deck },
      { character: boss, col: middle, role: "antagonist", row: deck - 4 },
    ],
    refuges: [{ at: { col: inside, row: step }, kind, width: NOOK.cols - 2 * NOOK.open - 3 }],
    route: {},
    routes: [
      {
        id: "floor",
        waypoints: [
          { col: left, row },
          { col: right, row },
        ],
      },
      {
        id: "nook",
        waypoints: [
          { col: left, row },
          { col: inside + 1, row: step },
        ],
      },
      {
        id: "loop",
        waypoints: [
          { col: left, row },
          { col: middle, row },
          { col: right, row },
          { col: right, row: deck },
          { col: middle, row: deck },
          { col: left, row: deck },
          { col: left, row },
        ],
      },
    ],
    solids: [
      ground(0, 60, row),
      slab(NOOK.col, NOOK.cols, step, 2),
      slab(NOOK.col + NOOK.open, NOOK.cols - 2 * NOOK.open, step - 5, 2),
    ],
    stage,
  };
}

export const ARENA_SAMPLES: readonly ChunkArena[] = [
  sample({ boss: "dog-antagonist", kind: "high-ground", row: 80, stage: "city-streets" }),
  sample({ boss: "goose-antagonist", kind: "high-ground", row: 80, stage: "country-lanes" }),
  sample({ boss: "bear-antagonist", kind: "high-ground", row: 80, stage: "deep-woods" }),
  sample({ boss: "raccoon-antagonist", kind: "low-ceiling", row: 80, stage: "back-streets" }),
  sample({ boss: "pigeon-antagonist", kind: "cover", row: 80, stage: "loading-yards" }),
  sample({ boss: "ferret-antagonist", kind: "cover", row: 50, stage: "residential-floors" }),
];
