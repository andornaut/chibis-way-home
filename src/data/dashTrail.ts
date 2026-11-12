import type { DashTrailTuning } from "./types/index.ts";

export const DASH_TRAIL: DashTrailTuning = {
  borderColour: "ink",
  borderThickness: 1,
  headColumns: 6,
  headDecay: 0.25,
  lengthDecay: 0.25,
  lines: [
    { alpha: 1, colour: "cream", gap: 4, length: 36, y: 14 },
    { alpha: 1, colour: "cream", gap: 8, length: 27, y: 23 },
    { alpha: 1, colour: "cream", gap: 5, length: 18, y: 32 },
  ],
  thickness: 2,
  tipFadeExponent: 1.35,
};
