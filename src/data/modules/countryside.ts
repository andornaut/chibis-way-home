import { WINDMILL_SAILS, windmillSailOrbit } from "../obstacleTuning.ts";
import type { ChunkModule, Instance, TerrainRect } from "../types/index.ts";

// Countryside halves on the lower route (rows 70 and 80). The windmill fills the right half and
// climbs from row 80 to row 70; its lookout fills the left half in front of it. Neither holds an
// encounter.
const ROWS = 120;

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});

// The windmill: an approach at the joint (row 80), a wheel of sails over a trough 5 rows down,
// and an exit bank 10 rows up, beyond a jump from the approach. The hub sits half a row below the
// exit bank's top, so the sail stopped on the rising side stands level and flush with the bank,
// and the sail stopped at the bottom 3 rows above the approach. The hub's plinth stands on a step
// 1 row above the trough. The wheel's bounds (cols 6 to 25) and spokes stay 4 cols clear of both
// module edges.
const WINDMILL = {
  approach: { cols: 6, row: 80 },
  exit: { col: 25, row: 70 },
  hub: { col: 15.5, row: 70.5 },
  plinth: { col: 11, cols: 9, row: 84 },
  trough: { col: 6, cols: 19, row: 85 },
} as const;
const HUB = { cols: 12, rows: 28 };
const SAIL = { cols: 5, rows: 1 };

const windmill: ChunkModule = {
  difficulty: 4,
  encounters: 0,
  entry: { row: WINDMILL.approach.row },
  exit: { row: WINDMILL.exit.row },
  id: "windmill",
  noCross: [
    {
      from: { col: WINDMILL.approach.cols - 2, row: WINDMILL.approach.row },
      to: { col: WINDMILL.exit.col + 2, row: WINDMILL.exit.row },
    },
  ],
  objects: [
    {
      character: "countryside-windmill",
      col: WINDMILL.hub.col - HUB.cols / 2,
      id: "hub",
      row: WINDMILL.hub.row - HUB.rows / 2,
    },
    ...Array.from({ length: WINDMILL_SAILS.count }, (_, index): Instance => {
      const orbit = windmillSailOrbit("hub", index);
      return {
        character: "windmill-sail-ledge",
        col: WINDMILL.hub.col + orbit.radius * Math.cos(orbit.phase) - SAIL.cols / 2,
        orbit,
        row: WINDMILL.hub.row + orbit.radius * Math.sin(orbit.phase) - SAIL.rows / 2,
        tether: { art: "windmill-spoke" },
      };
    }),
  ],
  route: { profile: "recovery" },
  sides: ["right"],
  solids: [
    floor(0, WINDMILL.approach.cols, WINDMILL.approach.row),
    floor(WINDMILL.trough.col, WINDMILL.plinth.col - WINDMILL.trough.col, WINDMILL.trough.row),
    floor(WINDMILL.plinth.col, WINDMILL.plinth.cols, WINDMILL.plinth.row),
    floor(
      WINDMILL.plinth.col + WINDMILL.plinth.cols,
      WINDMILL.exit.col - WINDMILL.plinth.col - WINDMILL.plinth.cols,
      WINDMILL.trough.row,
    ),
    floor(WINDMILL.exit.col, 30 - WINDMILL.exit.col, WINDMILL.exit.row),
  ],
  zones: ["countryside"],
};

// The windmill's lookout: a knoll 5 rows up, a full jump, from which the turning wheel shows
// before the approach.
const lookout: ChunkModule = {
  difficulty: 2,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "windmill-lookout",
  objects: [],
  route: { profile: "recovery", targets: [{ at: { col: 15, row: 75 } }] },
  sides: ["left"],
  solids: [floor(0, 8, 80), floor(8, 14, 75), floor(22, 8, 80)],
  zones: ["countryside"],
};

export const COUNTRYSIDE_MODULES: Readonly<Record<string, ChunkModule>> = Object.fromEntries(
  [lookout, windmill].map((module) => [module.id, module]),
);
