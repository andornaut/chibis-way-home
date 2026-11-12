import { HIT_RULE } from "@andornaut/game-kit/ui/hitAreas";
import type { LayoutValues } from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { FOCUS_RING, SETTINGS_CARD } from "../../data/layout.ts";
import type { Rect } from "../../data/types/index.ts";
import { ACTION_HELP } from "./actionHelp.ts";
import { FONT_METRICS } from "./fontRoles.ts";

// The settings card's and the install steps card's geometry in base px (src/ui/dom/settings.css
// lays them out): each row is its own press target, already the minimum target height, so it
// gains no margin; its icons, name and switch or compact Install face sit in it, the switches and
// the face at the widest row's right end. A touch row's name is its label over its note, two body
// lines within the row's height. Each row's icons are centred in one slot as wide as Action
// buttons' Use and Jump, each one body line square, the action help gap apart, so every row's
// name starts at the same x. Install steps wrap within the steps width beside their glyph, or
// across the glyph's width as well for a browser without one.
export const SETTINGS_LAYOUT: LayoutValues = {
  "--settings-icon": SETTINGS_CARD.icon,
  "--settings-icon-gap": ACTION_HELP.gap,
  "--settings-icon-slot": 2 * FONT_METRICS.body.lineHeight + ACTION_HELP.gap,
  "--settings-install-height": SETTINGS_CARD.install.height,
  "--settings-install-inset": SETTINGS_CARD.install.inset,
  "--settings-install-width": SETTINGS_CARD.install.width,
  "--settings-row-height": HIT_RULE.minTarget,
  "--settings-steps-width": SETTINGS_CARD.stepsTextWidth,
  "--settings-switch-height": SETTINGS_CARD.switch.height,
  "--settings-switch-width": SETTINGS_CARD.switch.width,
};

// Art's keyboard focus ring, a 9-slice drawn this far outside the focused row, button or close X
// on every side.
const FOCUS_OUTSET = FOCUS_RING.outset;

export function focusRingAround({ height, width, x, y }: Rect): Rect {
  return {
    height: height + 2 * FOCUS_OUTSET,
    width: width + 2 * FOCUS_OUTSET,
    x: x - FOCUS_OUTSET,
    y: y - FOCUS_OUTSET,
  };
}
