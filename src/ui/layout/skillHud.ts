import {
  ACTION_GAPS,
  type ActionArrangement,
  type ActionGroupContext,
  arrangeActions,
} from "@andornaut/game-kit/runtime/ui/actionGroup";
import type { HitRule } from "@andornaut/game-kit/runtime/ui/hitAreas";
import { hudDiscIconOffset } from "@andornaut/game-kit/runtime/ui/hudDisc";

import { HUD_EDGE, SKILL_HUD } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Point, Rect, SkillId } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { HUD_DISC_SIZES } from "./controlChrome.ts";
import { topBarDiscY } from "./topBar.ts";

const SIZE = HUD_DISC_SIZES.skill;

// A skill button's drawn disc, glyph and square target sides.
export const SKILL_BUTTON = {
  disc: SIZE.face,
  glyph: SIZE.icon,
  target: SKILL_HUD.target,
} as const;

// A skill's press area is its square target about its disc, with the spare pixel of the odd
// difference right and below.
const PRESS: HitRule = {
  leastMargin: 0,
  marginShare: 0,
  minTarget: SKILL_BUTTON.target,
  mostMargin: 0,
};

// The skill HUD as a kit action group: one row of small buttons, the discs the small gap apart.
export const SKILL_HUD_GROUP = {
  axis: "row",
  gap: "small",
  press: PRESS,
} as const satisfies Omit<ActionGroupContext, "width">;

// The row's faces' top in the base view: centred on the top section, on a whole pixel.
export const SKILL_HUD_TOP = topBarDiscY(SIZE.face);

// The skills shown, in SKILL_IDS order: skills not shown take no slot.
export function skillHudItems(shown: readonly SkillId[]) {
  return SKILL_IDS.map((key) => ({
    hidden: !shown.includes(key),
    key,
    role: "secondary" as const,
    size: { height: SIZE.face, width: SIZE.face },
  }));
}

// The row's width for count discs: the group's room across, which its faces fill.
export function skillHudWidth(count: number): number {
  return count * SIZE.face + Math.max(0, count - 1) * ACTION_GAPS[SKILL_HUD_GROUP.gap].row;
}

// The row in the base view: packed against the view's right with the rightmost disc HUD_EDGE in
// from it. Like the entry, the row moves with the view (viewShift).
export function arrangeSkillHud(shown: readonly SkillId[]): ActionArrangement<SkillId> {
  const items = skillHudItems(shown);
  const width = skillHudWidth(items.filter((item) => !item.hidden).length);
  return arrangeActions(
    {
      ...SKILL_HUD_GROUP,
      origin: { x: SCREEN.width - HUD_EDGE - width, y: SKILL_HUD_TOP },
      width,
    },
    items,
  );
}

// Where each shown skill's button target sits in the base view.
export function skillHud(shown: readonly SkillId[]): ReadonlyMap<SkillId, Point> {
  return new Map(
    arrangeSkillHud(shown).actions.flatMap((action) =>
      action.hidden ? [] : [[action.key, { x: action.press.x, y: action.press.y }]],
    ),
  );
}

export const SKILL_ART: Readonly<Record<SkillId, string>> = {
  dash: "icon-skill-dash",
  doubleJump: "icon-skill-double-jump",
  speedy: "icon-skill-speedy",
};

// A skill button's disc, glyph and press target for its target's corner at.
export function skillButton(at: Point) {
  const hit: Rect = { ...at, height: SKILL_BUTTON.target, width: SKILL_BUTTON.target };
  const margin = Math.floor((SKILL_BUTTON.target - SKILL_BUTTON.disc) / 2);
  const disc = { x: at.x + margin, y: at.y + margin };
  const offset = hudDiscIconOffset(SIZE);
  return { disc, glyph: { x: disc.x + offset.x, y: disc.y + offset.y }, hit };
}
