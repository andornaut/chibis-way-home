import { SMALL_BUTTON_GAP } from "@andornaut/game-kit/ui/spacing";

import { HUD_EDGE, SKILL_HUD } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Point, Rect, SkillId } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { PAUSE_VISIBLE_DIAMETER } from "./controlChrome.ts";

// A skill button's drawn disc, glyph and square target sides.
export const SKILL_BUTTON = {
  disc: PAUSE_VISIBLE_DIAMETER,
  glyph: SKILL_HUD.glyph,
  target: SKILL_HUD.target,
} as const;
// How far a button's target reaches past its centred disc on each side.
const DISC_MARGIN = (SKILL_BUTTON.target - SKILL_BUTTON.disc) / 2;
// The gap between neighbouring targets that puts their discs, small buttons, the kit's small
// button gap apart.
export const SKILL_TARGET_GAP = SMALL_BUTTON_GAP - 2 * DISC_MARGIN;
// Where each shown skill's button target sits in the base view: one row along the view's top,
// packed against its right edge in SKILL_IDS order with discs SMALL_BUTTON_GAP apart, each disc
// HUD_EDGE in from the top and the rightmost disc HUD_EDGE in from the right. Skills not shown
// take no slot. Like the pause button, the row moves with the view (viewShift).
export function skillHud(shown: readonly SkillId[]): ReadonlyMap<SkillId, Point> {
  const row = SKILL_IDS.filter((skill) => shown.includes(skill));
  const right = SCREEN.width - HUD_EDGE + DISC_MARGIN;
  return new Map(
    row.map((skill, index) => [
      skill,
      {
        x:
          right -
          SKILL_BUTTON.target -
          (row.length - 1 - index) * (SKILL_BUTTON.target + SKILL_TARGET_GAP),
        y: HUD_EDGE - DISC_MARGIN,
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
  const glyphOffset = (SKILL_BUTTON.target - SKILL_BUTTON.glyph) / 2;
  return {
    disc: { x: at.x + DISC_MARGIN, y: at.y + DISC_MARGIN },
    glyph: { x: at.x + glyphOffset, y: at.y + glyphOffset },
    hit,
  };
}
