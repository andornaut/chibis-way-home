import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird.ts";
import type { SkillId } from "../data/types/index.ts";
import { resolveActiveSkill, SKILL_IDS, skillTuning } from "./skills.ts";

describe("owned skills", () => {
  it.each(SKILL_IDS)("applies only the selected %s effect", (selected) => {
    const tuning = { speedyWalkMultiplier: 1.25 };
    const profile = skillTuning(tuning, selected, BIRD);
    expect(profile.dash).toEqual(selected === "dash" ? BIRD.dash : undefined);
    expect(profile.doubleJump).toBe(selected === "doubleJump");
    expect(profile.walkSpeed).toBe(
      BIRD.walkSpeed * (selected === "speedy" ? tuning.speedyWalkMultiplier : 1),
    );
    expect(profile.jumpSpeed).toBe(BIRD.jumpSpeed);
  });
  it("selects nothing on its own and retains only an owned selection", () => {
    const owned: readonly SkillId[] = ["speedy", "dash"];
    expect(resolveActiveSkill(owned, null)).toBeNull();
    expect(resolveActiveSkill(owned, "dash")).toBe("dash");
    expect(resolveActiveSkill(owned, "doubleJump")).toBeNull();
    expect(resolveActiveSkill([], "dash")).toBeNull();
    expect(skillTuning({ speedyWalkMultiplier: 1.25 }, null, BIRD)).toMatchObject({
      doubleJump: false,
      walkSpeed: BIRD.walkSpeed,
    });
  });
});
