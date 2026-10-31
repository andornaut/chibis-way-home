import type { ChunkPlan } from "./types";

// A shared horizontal encounter with a waiting ledge on each side.
export const PATROL_FINISH_GEOMETRY: Pick<ChunkPlan, "objects" | "solids"> = {
  objects: [
    { character: "platform-ledge", col: 6, cols: 6, role: "ledge", row: 46 },
    { character: "dog-antagonist", col: 31, role: "antagonist", row: 46 },
    { character: "platform-ledge", col: 42, cols: 6, role: "ledge", row: 46 },
  ],
  solids: [{ col: 0, cols: 60, look: "ground", row: 50, rows: 10 }],
};

export const BOUNDARY_START: Omit<ChunkPlan, "theme"> = {
  backdrops: [
    { character: "facade-one-storey", col: 0, cols: 60, role: "boundary-wall", row: 34 },
    { character: "depot-loading-bay", col: 30, role: "loading-bay", row: 40 },
  ],
  cols: 60,
  difficulty: 1,
  entry: { row: 50 },
  exit: { row: 50 },
  objects: [],
  slots: [{ area: { col: 18, cols: 4, row: 46, rows: 4 }, id: "loading-room", kind: "door" }],
  solids: [{ col: 0, cols: 60, look: "ground", row: 50, rows: 10 }],
};

// The antagonist climbs beside the stack. The approach ledge lets the bird wait for its drop.
export const VERTICAL_FINISH: Omit<ChunkPlan, "theme"> = {
  backdrops: [{ character: "facade-one-storey", col: 4, cols: 12, role: "near-wall", row: 34 }],
  cols: 60,
  difficulty: 4,
  entry: { row: 50 },
  exit: { row: 50 },
  objects: [
    { character: "platform-ledge", col: 20, cols: 6, role: "ledge", row: 45 },
    { character: "raccoon-antagonist", col: 26, role: "antagonist", row: 46 },
  ],
  solids: [
    { col: 0, cols: 30, look: "ground", row: 50, rows: 10 },
    { col: 30, cols: 12, look: "raised", row: 40, rows: 20 },
    { col: 42, cols: 6, look: "raised", row: 45, rows: 15 },
    { col: 48, cols: 12, look: "ground", row: 50, rows: 10 },
  ],
};
