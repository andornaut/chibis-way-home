import type { CrumblingProfile } from "@andornaut/game-kit/terrain/crumbling";

export const CRUMBLING_SUPPORT_TUNING = {
  absentSeconds: 2,
  warningSeconds: 0.8,
} as const satisfies CrumblingProfile;
