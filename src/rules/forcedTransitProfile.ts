import { BIRD } from "../data/bird";
import { SKILLS } from "../data/skills";
import type { BirdTuning } from "../data/types";
import { type BirdState, EDGE } from "./bird";
import { SKILL_IDS, skillTuning } from "./skills";

const PROFILES = [null, ...SKILL_IDS].map((selected) => skillTuning(SKILLS, selected, BIRD));
const MAXIMUM_WALK_SPEED = Math.max(...PROFILES.map(({ walkSpeed }) => walkSpeed));

export function ordinaryTransitControl(tuning: BirdTuning, bird: BirdState): boolean {
  return (
    ordinaryTransitProfile(tuning) !== undefined &&
    bird.grounded &&
    Number.isFinite(bird.vx) &&
    Math.abs(bird.vx) <= MAXIMUM_WALK_SPEED &&
    bird.vy === 0 &&
    bird.carryVx === 0 &&
    (bird.dash?.remainingSeconds ?? 0) <= EDGE
  );
}

export function ordinaryTransitProfile(tuning: BirdTuning): BirdTuning | undefined {
  // Inactive Dash and extra-jump eligibility do not affect a fresh ordinary ground Jump.
  const keys = [...new Set([...Object.keys(tuning), ...Object.keys(BIRD)])].filter(
    (key) => key !== "dash" && key !== "doubleJump",
  ) as (keyof BirdTuning)[];
  return PROFILES.find((profile) => keys.every((key) => tuning[key] === profile[key]));
}
