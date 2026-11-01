import type { CameraTuning } from "./types";

export const CAMERA = {
  contactShake: {
    distance: 5,
    durationMs: 280,
    firstOffMs: 80,
    secondOffMs: 200,
    secondOnMs: 120,
  },
  groundSpot: 2 / 3,
  seamEase: 1 / 2,
} satisfies CameraTuning;
