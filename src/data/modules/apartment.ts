import { CHANDELIER_SWING, chandelierOrbit } from "../obstacleTuning.ts";
import type { ChunkModule, Instance, TerrainRect } from "../types/index.ts";

// Apartment halves on the lower route (row 80): the swinging chandelier and the approach before
// it.
const ROWS = 120;
const ROW = 80;

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});
const red = (col: number, cols: number, row: number): readonly Instance[] => [
  { character: "red-edge-top", col, cols, role: "edge-top", row: row - 1 },
  { character: "red-edge-support", col, cols, role: "support", row, rows: ROWS - row },
];

// The chandelier's pivot, 11 cols into its 22-col gap and 5 rows above the banks, so its rim
// holding at either end of the swing stands level and flush with that bank.
const PIVOT = { col: 15, row: ROW - 5 } as const;
// At area entry the rim's centre is 2.8 cols left of the pivot and 9.6 rows below it, on the swing
// back toward the near end, which it reaches as Chibi arrives from the chunk's entry.
const START_SIN = -0.28;
const START_COS = 0.96;
const startPhase = (): number => {
  const orbit = chandelierOrbit("mount", 0);
  const swing = (2 * orbit.amplitude) / orbit.angularSpeed;
  const cycle = 2 * (orbit.pause + swing);
  const swung = (orbit.amplitude - Math.asin(START_SIN)) / orbit.angularSpeed;
  return (cycle / 2 + orbit.pause + swung) / cycle;
};

const MODULE_LIST: readonly ChunkModule[] = [
  // Grade 2: a flat run with a 2-tile red strip to jump, from which the chandelier ahead is in
  // view.
  {
    difficulty: 2,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "chandelier-approach",
    objects: red(13, 2, ROW),
    route: { profile: "recovery" },
    sides: ["left"],
    solids: [floor(0, 13, ROW), floor(15, 15, ROW)],
    zones: ["apartment"],
  },
  // Grade 4: the swinging chandelier across a 22-col gap between the 4-col banks, under a ceiling
  // beam that covers its arc. A miss from the near bank lands on a step 5 rows down that climbs
  // back to it; a fall from the swing lands on the floor 8 rows down, beyond a jump of the far
  // bank, which hops back up to that step, so the ride is required.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "chandelier-swing",
    noCross: [
      { from: { col: 2, row: ROW }, to: { col: 28, row: ROW } },
      { from: { col: 16, row: ROW + 8 }, to: { col: 28, row: ROW } },
    ],
    objects: [
      {
        character: "apartment-chandelier-mount",
        col: PIVOT.col - 1,
        id: "mount",
        row: PIVOT.row - 0.5,
      },
      {
        character: "apartment-chandelier",
        col: PIVOT.col + CHANDELIER_SWING.length * START_SIN - 3,
        orbit: chandelierOrbit("mount", startPhase()),
        row: PIVOT.row + CHANDELIER_SWING.length * START_COS - 1,
        tether: { art: "apartment-chandelier-chain" },
      },
    ],
    route: { profile: "recovery" },
    sides: ["right"],
    solids: [
      floor(0, 4, ROW),
      floor(4, 3, ROW + 5),
      floor(7, 19, ROW + 8),
      floor(26, 4, ROW),
      { col: 5, cols: 20, look: "raised", row: PIVOT.row - 5, rows: 4 },
    ],
    zones: ["apartment"],
  },
];

export const APARTMENT_MODULES: Readonly<Record<string, ChunkModule>> = Object.fromEntries(
  MODULE_LIST.map((module) => [module.id, module]),
);
