import { AWNING_SECONDS, awningCycle } from "../obstacleBehaviours.ts";
import type { ChunkModule, Instance, SupportCycleSeconds, TerrainRect } from "../types/index.ts";

// Home city halves on the lower route (row 80). The awning row fills the right half, after the
// half Chibi watches it from, so a chunk never holds two clocked obstacles.
const ROWS = 120;

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});
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
];

export const HOME_MODULES: Readonly<Record<string, ChunkModule>> = Object.fromEntries(
  MODULE_LIST.map((module) => [module.id, module]),
);
