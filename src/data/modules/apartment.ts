import { CITY_SHUTTLE_BEHAVIOUR } from "../behaviours.ts";
import { CHANDELIER_SWING, chandelierOrbit, CRUMBLING_SUPPORT_TUNING } from "../obstacleTuning.ts";
import type { ChunkModule, Instance, TerrainRect } from "../types/index.ts";

// Apartment halves on the lower route (row 80).
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
  // Successive narrow piers climb across a red channel, then descend to a supported exit bank.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "apartment-stepped-piers",
    objects: red(4, 22, 92),
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 11.5, row: 76 } },
        { at: { col: 21.5, row: 71 } },
        { at: { col: 28, row: ROW } },
      ],
    },
    sides: ["right"],
    solids: [floor(0, 4, ROW), floor(10, 3, 76), floor(20, 3, 71), floor(26, 4, ROW)],
    zones: ["apartment"],
  },
  // A high cantilever and a covered lower refuge lead across a red strip to the return steps.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "apartment-cantilever-return",
    objects: red(18, 2, 88),
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 12, row: 75 } },
        { at: { col: 14, row: 88 }, xRange: { max: 14, min: 12 } },
        { at: { col: 24, row: 84 } },
        { at: { col: 28, row: ROW } },
      ],
    },
    sides: ["right"],
    solids: [
      floor(0, 4, ROW),
      floor(4, 18, 88),
      floor(22, 4, 84),
      floor(26, 4, ROW),
      { col: 6, cols: 12, look: "raised", row: 75, rows: 2 },
    ],
    zones: ["apartment"],
  },
  // A lower shelf starts successive rising transfers above a red channel.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "apartment-staggered-shelves",
    objects: [
      { character: "platform-ledge", col: 8, cols: 4, role: "ledge", row: 83 },
      { character: "platform-ledge", col: 17, cols: 3, role: "ledge", row: 78 },
      { character: "platform-ledge", col: 22, cols: 4, role: "ledge", row: 74 },
      ...red(4, 22, 94),
    ],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 10, row: 83 } },
        { at: { col: 18.5, row: 78 } },
        { at: { col: 24, row: 74 } },
        { at: { col: 28, row: ROW } },
      ],
    },
    sides: ["right"],
    solids: [floor(0, 4, ROW), floor(26, 4, ROW)],
    zones: ["apartment"],
  },
  // A raised approach boards a shuttle above the red channel before the lower exit bank.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "apartment-shuttle-overpass",
    objects: [
      {
        behaviour: { ...CITY_SHUTTLE_BEHAVIOUR, distance: 12 },
        character: "city-shuttle",
        col: 8,
        cols: 6,
        role: "shuttle",
        row: 76,
      },
      ...red(8, 18, 92),
    ],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 6, row: 76 } },
        { at: { col: 11, row: 76 } },
        { at: { col: 28, row: ROW } },
      ],
    },
    sides: ["right"],
    solids: [floor(0, 4, ROW), floor(4, 4, 76), floor(26, 4, ROW)],
    zones: ["apartment"],
  },
  // A lower vent chamber has grounded observation on both sides and a stepped return.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "apartment-vent-return",
    objects: [{ character: "warned-vent", col: 15, row: 82 }],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 7, row: 84 } },
        { at: { col: 13, row: 88 }, xRange: { max: 13, min: 12 } },
        { at: { col: 21, row: 88 }, xRange: { max: 21, min: 20 } },
        { at: { col: 24.5, row: 84 } },
        { at: { col: 28, row: ROW } },
      ],
    },
    sides: ["right"],
    solids: [
      floor(0, 4, ROW),
      floor(4, 6, 84),
      floor(10, 13, 88),
      floor(23, 3, 84),
      floor(26, 4, ROW),
    ],
    zones: ["apartment"],
  },
  // Two contact-triggered balconies climb toward a fixed recovery pier and the exit bank.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "apartment-crumbling-stair",
    objects: [
      {
        character: "platform-ledge",
        col: 7,
        cols: 4,
        crumbling: CRUMBLING_SUPPORT_TUNING,
        role: "ledge",
        row: 77,
      },
      {
        character: "platform-ledge",
        col: 14,
        cols: 4,
        crumbling: CRUMBLING_SUPPORT_TUNING,
        role: "ledge",
        row: 73,
      },
      ...red(4, 18, 92),
    ],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 9, row: 77 }, xRange: { max: 9, min: 7 } },
        { at: { col: 16, row: 73 }, xRange: { max: 16, min: 14 } },
        { at: { col: 24, row: 76 } },
        { at: { col: 28, row: ROW } },
      ],
    },
    sides: ["right"],
    solids: [floor(0, 4, ROW), floor(22, 4, 76), floor(26, 4, ROW)],
    zones: ["apartment"],
  },
  // A terrace, grounded lower refuge and raised shelf approach the red gap.
  {
    difficulty: 3,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "apartment-terraced-approach",
    objects: [
      { character: "platform-ledge", col: 16, cols: 6, role: "ledge", row: 75 },
      ...red(18, 6, 92),
    ],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 9, row: 76 } },
        { at: { col: 15, row: ROW }, xRange: { max: 15, min: 13 } },
        { at: { col: 19, row: 75 } },
        { at: { col: 27, row: ROW }, xRange: { max: 27, min: 25 } },
      ],
    },
    sides: ["left"],
    solids: [floor(0, 6, ROW), floor(6, 6, 76), floor(12, 6, ROW), floor(24, 6, ROW)],
    zones: ["apartment"],
  },
  // Upper staging drops to an isolated lower island before the return to the joint bank.
  {
    difficulty: 3,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "apartment-lower-island-approach",
    objects: [
      { character: "platform-ledge", col: 6, cols: 6, role: "ledge", row: 75 },
      ...red(12, 4, 94),
      ...red(20, 4, 94),
    ],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 9, row: 75 } },
        { at: { col: 18, row: 84 } },
        { at: { col: 27, row: ROW }, xRange: { max: 27, min: 25 } },
      ],
    },
    sides: ["left"],
    solids: [floor(0, 12, ROW), floor(16, 4, 84), floor(24, 6, ROW)],
    zones: ["apartment"],
  },
];

export const APARTMENT_MODULES: Readonly<Record<string, ChunkModule>> = Object.fromEntries(
  MODULE_LIST.map((module) => [module.id, module]),
);
