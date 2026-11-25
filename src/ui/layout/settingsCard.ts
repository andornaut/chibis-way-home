import type { FormRowLayout } from "@andornaut/game-kit/runtime/ui/formRow";
import { HIT_RULE } from "@andornaut/game-kit/runtime/ui/hitAreas";
import type { LayoutValues } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { CARD_CONTENT, SETTINGS_CARD } from "../../data/layout.ts";
import { ACTION_HELP } from "./actionHelp.ts";
import { FONT_METRICS } from "./fontRoles.ts";

// A switch row's geometry in base px, on the kit's form rows (formRow.css): each row is its own
// press target, at least the minimum target high and taller where its text wraps, so it gains no
// margin. Its label over its note is one block, centred on the row's height as its switch is. The
// switch, at art's size, sits over its state word, centred on it, the row gap apart, in a value
// column as wide as its list's widest state word.
export const SWITCH_ROWS = {
  columnGap: CARD_CONTENT.gap,
  height: HIT_RULE.minTarget,
  switch: SETTINGS_CARD.switch,
  value: { gap: CARD_CONTENT.rowGap, state: "center" },
} as const satisfies FormRowLayout;

// The gap between a touch row's two control icons.
const ICON_GAP = ACTION_HELP.gap;

// A Settings row leads with its icons, centred in one slot as wide as Action buttons' Use and
// Jump icons, each one body line square, so every row's label starts at the same x.
export const SETTINGS_ROWS = {
  ...SWITCH_ROWS,
  icon: { size: SETTINGS_CARD.icon, slot: 2 * FONT_METRICS.body.lineHeight + ICON_GAP },
} as const satisfies FormRowLayout;

// The lengths settings.css reads, in base px: the sprite icon's side, the gap between a touch
// row's control icons, the gap between Install's icon and its label, and the width install steps
// wrap within beside their glyph (and across the glyph's width as well without one).
export const SETTINGS_LAYOUT: LayoutValues = {
  "--settings-icon": SETTINGS_CARD.icon,
  "--settings-icon-gap": ICON_GAP,
  "--settings-install-gap": SETTINGS_CARD.installIconGap,
  "--settings-steps-width": SETTINGS_CARD.stepsTextWidth,
};
