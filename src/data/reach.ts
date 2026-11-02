import type { Reaches } from "./types";

// Gameplay's targets: the bird makes each reach exactly, and never one tile more.
export const REACH: Reaches = {
  gap: 17,
  hop: 3,
  jump: 6,
};
