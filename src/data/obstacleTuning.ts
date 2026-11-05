import type { CrumblingProfile } from "@andornaut/game-kit/terrain/crumbling";

export const CRUMBLING_SUPPORT_TUNING = {
  absentSeconds: 2,
  warningSeconds: 0.8,
} as const satisfies CrumblingProfile;

// New obstacle movers (gantry crane, windmill sails, chandelier) travel along their path at this
// many tiles per second and pause this many seconds at each end.
export const OBSTACLE_MOVER_SPEED = 4;
export const OBSTACLE_MOVER_PAUSE = 1;
