// One sample arena per boss for the arena tests, outside the game's pool: a floor on the seam row,
// a deck six rows up that closes the loop, and under the deck a nook every boss is too tall to
// enter: a two-row step whose roof, a solid stretch of the deck, lies three rows above it,
// Chibi's height. A boss on either side of the nook crosses over it on the deck. The nook is high
// ground against charges, cover against parcels and droppings, and a low ceiling against Kiwi.
import type { AntagonistKind, ChunkArena, RefugeKind, SeamRow, TerrainRect } from "../data/types";

const ROWS = 120;
// The deck: one-way either side of the nook's solid roof, a sample's `gap` columns clear of the
// nook's ends (3 by default; Bini's growl favours 1).
const DECK = { col: 20, cols: 34, rise: 6 } as const;
// The nook's step, and its roof, which leaves `open` columns of the step clear at each end to
// climb in.
const NOOK = { col: 28, cols: 10, open: 2 } as const;

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
const ledge = (col: number, cols: number, row: number) => ({
  character: "platform-ledge",
  col,
  cols,
  role: "ledge",
  row,
});

interface Sample {
  readonly boss: AntagonistKind;
  readonly gap?: number;
  readonly kind: RefugeKind;
  readonly row: SeamRow;
  readonly stage: string;
}

function sample({ boss, gap = 3, kind, row, stage }: Sample): ChunkArena {
  const deck = row - DECK.rise;
  const left = DECK.col + 2;
  const right = DECK.col + DECK.cols - 2;
  const far = right - 7;
  const step = row - 2;
  const roof = { col: NOOK.col + NOOK.open, cols: NOOK.cols - 2 * NOOK.open };
  const inside = roof.col + 1;
  return {
    boss,
    difficulty: 4,
    entry: { row },
    exit: { row },
    id: `arena-${boss.replace("-antagonist", "")}-sample`,
    objects: [
      ledge(DECK.col, NOOK.col - DECK.col - gap, deck),
      ledge(NOOK.col + NOOK.cols + gap, DECK.col + DECK.cols - NOOK.col - NOOK.cols - gap, deck),
      { character: boss, col: right - 4, role: "antagonist", row: deck - 4 },
    ],
    refuges: [{ at: { col: inside, row: step }, kind, width: roof.cols - 3 }],
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
          { col: far, row },
          { col: right, row },
          { col: right, row: deck },
          { col: far, row: deck },
          { col: left, row: deck },
          { col: left, row },
        ],
      },
    ],
    solids: [
      ground(0, 60, row),
      slab(NOOK.col, NOOK.cols, step, 2),
      slab(roof.col, roof.cols, deck, 1),
    ],
    stage,
  };
}

export const ARENA_SAMPLES: readonly ChunkArena[] = [
  sample({ boss: "dog-antagonist", kind: "high-ground", row: 80, stage: "city-streets" }),
  sample({ boss: "goose-antagonist", kind: "high-ground", row: 80, stage: "country-lanes" }),
  sample({ boss: "bear-antagonist", gap: 1, kind: "high-ground", row: 80, stage: "deep-woods" }),
  sample({ boss: "raccoon-antagonist", kind: "low-ceiling", row: 80, stage: "back-streets" }),
  sample({ boss: "pigeon-antagonist", kind: "cover", row: 80, stage: "loading-yards" }),
  sample({ boss: "ferret-antagonist", kind: "cover", row: 50, stage: "residential-floors" }),
];
