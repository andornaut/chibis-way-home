// Fairness bounds on each boss's attacks (`BossFairness` in `src/data/types/behaviour.ts`), by
// character. Recorded answers: a 0.6 s minimum reaction from tell start to contact, a 0.25 s
// dodge-witness reaction delay, at most 12 s between threats and a 0.4 s recovery bound.
import type { BossFairness, DodgeName } from "./types/index.ts";

const SHARED = {
  maxThreatGapSeconds: 12,
  minReactionSeconds: 0.6,
  reactionDelaySeconds: 0.25,
  recoveryMaxSeconds: 0.4,
  threatRadius: 3,
} as const;

// A rush is cleared by jumping over it as it closes, or by walking away during its tell.
const CHARGE: readonly DodgeName[] = ["jump-over", "retreat"];

export const BOSS_FAIRNESS: Readonly<Record<string, BossFairness>> = {
  "bear-antagonist": {
    ...SHARED,
    dodges: { charge: CHARGE, growl: ["jump-over", "retreat"], maul: ["retreat"] },
  },
  "dog-antagonist": { ...SHARED, dodges: { charge: CHARGE, pounce: ["retreat"] } },
  "ferret-antagonist": { ...SHARED, dodges: { charge: CHARGE, parcel: ["retreat"] } },
  "goose-antagonist": { ...SHARED, dodges: { charge: CHARGE, trap: ["retreat"] } },
  "pigeon-antagonist": {
    ...SHARED,
    dodges: { "drop-burst": ["retreat", "under"], swoop: ["retreat", "under"] },
  },
  "raccoon-antagonist": { ...SHARED, dodges: { charge: CHARGE, drop: ["retreat"] } },
};
