import { BIRD } from "../data/bird.ts";
import { SKILLS } from "../data/skills.ts";
import type { BirdTuning, SkillId, SkillTuning } from "../data/types/index.ts";

export const SKILL_IDS: readonly SkillId[] = ["dash", "doubleJump", "speedy"];
export function isSkillId(value: unknown): value is SkillId {
  return value === "dash" || value === "doubleJump" || value === "speedy";
}

// The selected skill while it is owned, or none.
export function resolveActiveSkill(
  owned: readonly SkillId[],
  selected: SkillId | null,
): SkillId | null {
  return selected !== null && owned.includes(selected) ? selected : null;
}

export function skillTuning(
  tuning: SkillTuning,
  selected: SkillId | null,
  bird: BirdTuning,
): BirdTuning {
  const { dash, ...ordinary } = bird;
  return {
    ...ordinary,
    ...(selected === "dash" && dash !== undefined ? { dash } : {}),
    doubleJump: selected === "doubleJump",
    walkSpeed: bird.walkSpeed * (selected === "speedy" ? tuning.speedyWalkMultiplier : 1),
  };
}

// The bird tuning under each skill selection, no skill first, then SKILL_IDS order.
export const SKILL_PROFILES: readonly BirdTuning[] = [null, ...SKILL_IDS].map((selected) =>
  skillTuning(SKILLS, selected, BIRD),
);
