import { SKILL_HUD } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import type { Point, Rect, SkillId } from "../../data/types";
import { SKILL_IDS } from "../../progress";
import { PAUSE_VISIBLE_DIAMETER } from "./controlChrome";

// A skill button's drawn disc, glyph and square target sides.
export const SKILL_BUTTON = {
  disc: PAUSE_VISIBLE_DIAMETER,
  glyph: SKILL_HUD.glyph,
  target: SKILL_HUD.target,
} as const;
// Where each shown skill's button sits in the base view: one row along the view's top, packed
// against its right edge in SKILL_IDS order, SKILL_HUD.inset in from the top and right and
// SKILL_HUD.gap apart. Skills not shown take no slot. Like the pause button, the row moves with
// the view (topShift).
export function skillHud(shown: readonly SkillId[]): ReadonlyMap<SkillId, Point> {
  const row = SKILL_IDS.filter((skill) => shown.includes(skill));
  return new Map(
    row.map((skill, index) => [
      skill,
      {
        x:
          SCREEN.width -
          SKILL_HUD.inset -
          SKILL_BUTTON.target -
          (row.length - 1 - index) * (SKILL_BUTTON.target + SKILL_HUD.gap),
        y: SKILL_HUD.inset,
      },
    ]),
  );
}
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
