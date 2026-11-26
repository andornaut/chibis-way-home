import { AWNING_SECONDS, awningCycle } from "../obstacleBehaviours.ts";
import { CRUMBLING_SUPPORT_TUNING } from "../obstacleTuning.ts";
import type { ChunkModule, Instance, SupportCycleSeconds, TerrainRect } from "../types/index.ts";

// Home city halves on the lower route (row 80). The awning row fills the right half, after the
// half Chibi watches it from, and no other half holds a clocked obstacle, so a chunk never holds
// two.
const ROWS = 120;

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});
// A red-topped pit floor across `cols` columns at `row`.
const red = (col: number, cols: number, row: number): readonly Instance[] => [
  { character: "red-edge-top", col, cols, role: "edge-top", row: row - 1 },
  { character: "red-edge-support", col, cols, role: "support", row, rows: ROWS - row },
];
// A wall-left awning whose standable top is row, starting in state initial.
const awning = (col: number, row: number, initial: keyof SupportCycleSeconds): Instance => ({
  behaviour: awningCycle(AWNING_SECONDS, initial),
  character: "homecity-awning-ledge",
  col,
  row,
});

const MODULE_LIST: readonly ChunkModule[] = [
  // Grade 2: a stoop to stand on and watch the next half from.
  {
    difficulty: 2,
    encounters: 0,
    entry: { row: 80 },
    exit: { row: 80 },
    id: "homecity-stoop",
    objects: [],
    route: { profile: "primary", targets: [{ at: { col: 14, row: 77 } }] },
    sides: ["left"],
    solids: [floor(0, 30, 80), { col: 12, cols: 4, look: "raised", row: 77, rows: 3 }],
    zones: ["home"],
  },
  // Grade 4: two awnings across a drop, the first starting extending and the second in its
  // warning, so the second comes out during the first's warning and one always holds Chibi. The
  // far run is out of reach of the entry run and of the lower street, so the crossing needs an
  // awning; a miss lands on the lower street, whose step climbs back to the entry run.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: 80 },
    exit: { row: 80 },
    id: "awning-row",
    noCross: [{ from: { col: 15, row: 88 }, to: { col: 28, row: 80 } }],
    objects: [awning(7, 80, "extending"), awning(17, 80, "warning")],
    route: {
      profile: "primary",
      targets: [{ at: { col: 15, row: 88 } }, { at: { col: 21, row: 80 } }],
    },
    sides: ["right"],
    solids: [
      floor(0, 4, 80),
      floor(4, 22, 88),
      { col: 4, cols: 2, look: "raised", row: 84, rows: 4 },
      floor(26, 4, 80),
    ],
    zones: ["home"],
  },
  // Grade 3: a running jump between two garden walls across a red pit; an overshoot steps down to
  // the street.
  {
    difficulty: 3,
    encounters: 0,
    entry: { row: 80 },
    exit: { row: 80 },
    id: "homecity-garden-walls",
    objects: red(9, 13, 90),
    route: {
      profile: "recovery",
      targets: [{ at: { col: 7, row: 75 } }, { at: { col: 24, row: 75 } }],
    },
    sides: ["left", "right"],
    solids: [floor(0, 5, 80), floor(5, 4, 75), floor(22, 4, 75), floor(26, 4, 80)],
    zones: ["home"],
  },
  // Grade 4: a crumbling balcony over a red pit, then a jump up to a rooftop before it goes and a
  // step down to the street.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: 80 },
    exit: { row: 80 },
    id: "homecity-crumbling-balcony",
    objects: [
      {
        character: "platform-ledge",
        col: 8,
        cols: 5,
        crumbling: CRUMBLING_SUPPORT_TUNING,
        role: "ledge",
        row: 76,
      },
      ...red(6, 12, 92),
    ],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 10.5, row: 76 }, xRange: { max: 11, min: 8 } },
        { at: { col: 21, row: 72 } },
      ],
    },
    sides: ["left", "right"],
    solids: [floor(0, 6, 80), floor(18, 6, 72), floor(24, 6, 80)],
    zones: ["home"],
  },
  // A covered lower courtyard returns to street level through two supported climbs.
  {
    difficulty: 3,
    encounters: 0,
    entry: { row: 80 },
    exit: { row: 80 },
    id: "homecity-underpass-approach",
    objects: [],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 14, row: 88 }, xRange: { max: 14, min: 10 } },
        { at: { col: 24, row: 84 } },
      ],
    },
    sides: ["left"],
    solids: [
      floor(0, 6, 80),
      floor(6, 16, 88),
      floor(22, 4, 84),
      floor(26, 4, 80),
      { col: 8, cols: 8, look: "raised", row: 79, rows: 2 },
    ],
    zones: ["home"],
  },
  // Broad fixed balconies rise and descend over a red channel before grounded recovery.
  {
    difficulty: 3,
    encounters: 0,
    entry: { row: 80 },
    exit: { row: 80 },
    id: "homecity-open-balconies",
    objects: [
      { character: "platform-ledge", col: 9, cols: 5, role: "ledge", row: 77 },
      { character: "platform-ledge", col: 18, cols: 5, role: "ledge", row: 81 },
      ...red(6, 18, 92),
    ],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 11.5, row: 77 } },
        { at: { col: 20.5, row: 81 } },
        { at: { col: 27, row: 80 }, xRange: { max: 27, min: 25 } },
      ],
    },
    sides: ["left"],
    solids: [floor(0, 6, 80), floor(24, 6, 80)],
    zones: ["home"],
  },
];

export const HOME_MODULES: Readonly<Record<string, ChunkModule>> = Object.fromEntries(
  MODULE_LIST.map((module) => [module.id, module]),
);
