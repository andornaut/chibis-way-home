import { STATIC_MOTION } from "./archetypes";
import { CHUNK_COLS } from "./chunkTemplates";
import { ZONE_ROWS } from "./screen";
import type { ChunkPlan, Instance, Motion, TerrainRect } from "./types";

const HOST_COLS = 6;
const HOST_ROWS = 1;
const ORBIT_RADIUS = 6;
const ORBIT_PHASE = Math.PI / 2;

function orbitingPlatform(
  col: number,
  row: number,
  direction: Motion["direction"],
  distance: number,
): readonly Instance[] {
  return [
    {
      character: "platform-ledge",
      col,
      cols: HOST_COLS,
      id: "host",
      overrides: {
        motion: {
          ...STATIC_MOTION,
          algorithm: "linear",
          direction,
          distance,
          pause: 0.6,
          speed: 4,
        },
      },
      role: "ledge",
      row,
      rows: HOST_ROWS,
    },
    {
      character: "red-edge-top",
      col: col + HOST_COLS / 2 + ORBIT_RADIUS * Math.cos(ORBIT_PHASE) - 0.5,
      orbit: {
        angularSpeed: Math.PI / 2,
        host: "host",
        kind: "circle",
        phase: ORBIT_PHASE,
        radius: ORBIT_RADIUS,
      },
      role: "edge-top",
      row: row + HOST_ROWS / 2 + ORBIT_RADIUS * Math.sin(ORBIT_PHASE) - 0.5,
    },
  ];
}

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: row === 50 ? "ground" : "raised",
  row,
  rows: ZONE_ROWS - row,
});

export function createOrbitHazardChunks(
  theme: ChunkPlan["theme"],
): Readonly<Record<string, ChunkPlan>> {
  return {
    "horizontal-platform-orbit": {
      cols: CHUNK_COLS,
      difficulty: 4,
      encounters: 0,
      entry: { row: 40 },
      exit: { row: 40 },
      objects: orbitingPlatform(18, 40, "right", 6),
      solids: [floor(0, 12, 40), floor(34, CHUNK_COLS - 34, 40)],
      theme,
    },
    "vertical-platform-orbit": {
      cols: CHUNK_COLS,
      difficulty: 4,
      encounters: 0,
      entry: { row: 50 },
      exit: { row: 30 },
      objects: orbitingPlatform(27, 42, "up", 10),
      solids: [floor(0, 10, 50), floor(10, 10, 45), floor(40, CHUNK_COLS - 40, 30)],
      theme,
    },
  };
}
