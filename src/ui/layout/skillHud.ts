import { SCREEN } from "../../data/screen";
import type { Point, Rect, SkillId } from "../../data/types";
import { SKILL_IDS } from "../../progress";
import { PAUSE_VISIBLE_DIAMETER } from "./controlChrome";
import { CONTROL_EDGE } from "./playView";

export const SKILL_BUTTON = { disc: PAUSE_VISIBLE_DIAMETER, glyph: 16, target: 48 } as const;
export const SKILL_HUD: Readonly<Record<SkillId, Point>> = Object.fromEntries(
  SKILL_IDS.map((skill, index) => [
    skill,
    {
      x:
        SCREEN.width -
        CONTROL_EDGE -
        SKILL_BUTTON.target -
        (SKILL_IDS.length - 1 - index) * (SKILL_BUTTON.target + CONTROL_EDGE),
      y: CONTROL_EDGE,
    },
  ]),
) as Readonly<Record<SkillId, Point>>;
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
