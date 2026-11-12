import type { AchievementId, SkillId } from "../../data/types/index.ts";
import { earnedAt } from "../achievements.ts";
import type { Progress } from "./progress.ts";
export function withGrantedSkill(progress: Progress, skill: SkillId): Progress {
  return progress.skills.includes(skill)
    ? progress
    : {
        ...progress,
        activeSkill: progress.activeSkill ?? skill,
        skills: [...progress.skills, skill],
      };
}
export function skillGrantEffects(
  earned: readonly AchievementId[],
  skillUsed: boolean,
  progress: Progress,
): {
  readonly awarded: readonly AchievementId[];
  readonly skillUsed: boolean;
} {
  const used = skillUsed || progress.activeSkill === "speedy";
  return {
    awarded: earnedAt(earned, "skill", { skillUsed: used, skills: progress.skills }),
    skillUsed: used,
  };
}
