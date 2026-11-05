import { BIRD } from "../data/bird";
import { SKILLS } from "../data/skills";
import type { BirdTuning, SkillId, SkillTuning } from "../data/types";

export const SKILL_IDS: readonly SkillId[] = ["dash", "doubleJump", "speedy"];
export type SkillOverrides = Readonly<Partial<Record<SkillId, boolean>>>;

export function isSkillId(value: unknown): value is SkillId {
  return value === "dash" || value === "doubleJump" || value === "speedy";
}

export function skillEnabled(
  overrides: SkillOverrides,
  owned: readonly SkillId[],
  skill: SkillId,
): boolean {
  return overrides[skill] === true || owned.includes(skill);
}

export function eligibleSkills(
  overrides: SkillOverrides,
  owned: readonly SkillId[],
): readonly SkillId[] {
  return [
    ...owned,
    ...SKILL_IDS.filter((skill) => !owned.includes(skill) && overrides[skill] === true),
  ];
}

export function resolveActiveSkill(
  eligible: readonly SkillId[],
  selected: SkillId | null,
): SkillId | null {
  return selected !== null && eligible.includes(selected) ? selected : (eligible[0] ?? null);
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
