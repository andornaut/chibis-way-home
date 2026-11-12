import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird.ts";
import {
  eligibleSkills,
  resolveActiveSkill,
  SKILL_IDS,
  skillEnabled,
  skillTuning,
} from "./skills.ts";

describe("permanent skills and temporary enabling", () => {
  it.each(SKILL_IDS)("never lets an unchecked override revoke saved %s", (skill) => {
    expect(skillEnabled({ [skill]: false }, [skill], skill)).toBe(true);
    expect(skillEnabled({ [skill]: false }, [], skill)).toBe(false);
    expect(skillEnabled({ [skill]: true }, [], skill)).toBe(true);
  });
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
  it("selects nothing on its own and retains a valid current selection", () => {
    const eligible = eligibleSkills({ dash: true, doubleJump: false }, ["speedy"]);
    expect(eligible).toEqual(["speedy", "dash"]);
    expect(resolveActiveSkill(eligible, null)).toBeNull();
    expect(resolveActiveSkill(eligible, "dash")).toBe("dash");
    expect(resolveActiveSkill(eligible, "doubleJump")).toBeNull();
    expect(resolveActiveSkill([], "dash")).toBeNull();
    expect(skillTuning({ speedyWalkMultiplier: 1.25 }, null, BIRD)).toMatchObject({
      doubleJump: false,
      walkSpeed: BIRD.walkSpeed,
    });
  });
});
