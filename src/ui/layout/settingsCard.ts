import { HIT_RULE } from "@andornaut/game-kit/ui/hitAreas";
import type { LayoutValues } from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { FOCUS_RING, SETTINGS_CARD } from "../../data/layout";
import type { Rect } from "../../data/types";

// The settings card's and the install steps card's geometry in base px (src/ui/dom/settings.css
// lays them out): each row is its own press target, already the minimum target height, so it
// gains no margin; its icon, label and switch or compact Install face sit in it, the switches and
// the face at the widest row's right end. Install steps wrap within the steps width beside their
// glyph, or across the glyph's width as well for a browser without one.
export const SETTINGS_LAYOUT: LayoutValues = {
  "--settings-icon": SETTINGS_CARD.icon,
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
