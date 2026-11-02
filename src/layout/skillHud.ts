import type { Point, Rect, SkillId } from "../data/types";

export const SKILL_BUTTON = { disc: 35, glyph: 16, target: 48 } as const;
export const SKILL_SELECTION = {
  bar: { height: 2, width: 5, x: 15, y: 27 },
  colour: "yellow",
  outline: 1,
} as const;
export const SKILL_HUD: Readonly<Record<SkillId, Point>> = {
  dash: { x: 664, y: 64 },
  doubleJump: { x: 664, y: 8 },
  speedy: { x: 608, y: 8 },
};
export const SKILL_ART: Readonly<Record<SkillId, string>> = {
  dash: "icon-skill-dash",
  doubleJump: "icon-skill-double-jump",
  speedy: "icon-skill-speedy",
};

export function skillButton(at: Point) {
  const hit: Rect = { ...at, height: SKILL_BUTTON.target, width: SKILL_BUTTON.target };
  const discOffset = Math.ceil((SKILL_BUTTON.target - SKILL_BUTTON.disc) / 2);
  const glyphOffset = (SKILL_BUTTON.target - SKILL_BUTTON.glyph) / 2;
  return {
    disc: { x: at.x + discOffset, y: at.y + discOffset },
    glyph: { x: at.x + glyphOffset, y: at.y + glyphOffset },
    hit,
  };
}
