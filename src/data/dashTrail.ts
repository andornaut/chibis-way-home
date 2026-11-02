import type { DashTrailTuning } from "./types";

export const DASH_TRAIL: DashTrailTuning = {
  lengthDecay: 0.25,
  lines: [
    { alpha: 0.95, colour: "cream", gap: 4, length: 32, y: 14 },
    { alpha: 0.8, colour: "lgrey", gap: 8, length: 24, y: 23 },
    { alpha: 0.65, colour: "lgrey", gap: 5, length: 16, y: 32 },
  ],
  thickness: 2,
  timeFadeExponent: 1.4,
  tipFadeExponent: 1.35,
};
