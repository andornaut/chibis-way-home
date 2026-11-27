import type { AchievementId, SkillId } from "../data/types/index.ts";
import { earnedAt, type Progress } from "../progress/index.ts";
// The progress owning skill. A grant never selects its skill and keeps the current selection.
export function withGrantedSkill(progress: Progress, skill: SkillId): Progress {
  return progress.skills.includes(skill) && progress.journeyGiftSkills.includes(skill)
    ? progress
    : {
        ...progress,
        journeyGiftSkills: progress.journeyGiftSkills.includes(skill)
          ? progress.journeyGiftSkills
          : [...progress.journeyGiftSkills, skill],
        skills: progress.skills.includes(skill) ? progress.skills : [...progress.skills, skill],
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
    awarded: earnedAt(earned, "skill", { skillUsed: used, skills: progress.journeyGiftSkills }),
    skillUsed: used,
  };
}
