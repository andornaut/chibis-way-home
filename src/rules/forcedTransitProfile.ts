import { EDGE } from "../core/index.ts";
import { BIRD } from "../data/bird.ts";
import type { BirdTuning } from "../data/types/index.ts";
import type { BirdState } from "./bird.ts";

// skillProfiles: the bird tuning under each skill selection, no skill included.
export function ordinaryTransitControl(
  skillProfiles: readonly BirdTuning[],
  tuning: BirdTuning,
  bird: BirdState,
): boolean {
  return (
    ordinaryTransitProfile(skillProfiles, tuning) !== undefined &&
    bird.grounded &&
    Number.isFinite(bird.vx) &&
    Math.abs(bird.vx) <= Math.max(...skillProfiles.map(({ walkSpeed }) => walkSpeed)) &&
    bird.vy === 0 &&
    bird.carryVx === 0 &&
    (bird.dash?.remainingSeconds ?? 0) <= EDGE
  );
}

function ordinaryTransitProfile(
  skillProfiles: readonly BirdTuning[],
  tuning: BirdTuning,
): BirdTuning | undefined {
  // Inactive Dash and extra-jump eligibility do not affect a fresh ordinary ground Jump.
  const keys = [...new Set([...Object.keys(tuning), ...Object.keys(BIRD)])].filter(
    (key) => key !== "dash" && key !== "doubleJump",
  ) as (keyof BirdTuning)[];
  return skillProfiles.find((profile) => keys.every((key) => tuning[key] === profile[key]));
}
