import { ACTION_GAPS } from "@andornaut/game-kit/runtime/ui/actionGroup";
import type { LayoutValues } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import {
  ACHIEVEMENTS_CARD,
  CARD_CONTENT,
  CARD_SCREEN_MARGIN,
  TEXT_BUTTON,
} from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { CARD_CLOSE } from "./cardClose.ts";
import { FONT_METRICS } from "./fontRoles.ts";

// The Achievements card's geometry in base px (src/ui/dom/achievements.css lays it out): on the
// card's frame, two columns of entries filled down each column then across, a page at a time,
// over a footer that stacks Previous, the page count and Next above Back.

// One entry's height: its title line and its description's lines, each a body line box.
const ENTRY_HEIGHT = FONT_METRICS.body.lineHeight * (1 + ACHIEVEMENTS_CARD.descriptionLines);

// The card's header (cardFrame.ts): it ends the gap below the close X's press target, where the
// list starts.
const HEADER = CARD_CLOSE.hit.y + CARD_CLOSE.hit.height + CARD_CONTENT.gap;

// The footer: the pager and Back, each a text button's height, the stacked gap apart.
export const ACHIEVEMENTS_FOOTER_HEIGHT = 2 * TEXT_BUTTON.height + ACTION_GAPS.standard.stack;

// The list's height at rows rows.
export function achievementsListHeight(rows: number): number {
  return rows * ENTRY_HEIGHT + Math.max(0, rows - 1) * CARD_CONTENT.gap;
}

// How many entries one page holds: two columns of as many rows as fit a card no taller than the
// view less the screen margin above and below, between its header and its footer.
export function achievementsPerPage(): number {
  const { gap, padding } = CARD_CONTENT;
  const room =
    SCREEN.height - 2 * CARD_SCREEN_MARGIN - HEADER - gap - ACHIEVEMENTS_FOOTER_HEIGHT - padding;
  const rows = Math.floor((room + gap) / (ENTRY_HEIGHT + gap));
  if (rows < 1) {
    throw new Error("No achievement row fits the view");
  }
  return rows * ACHIEVEMENTS_CARD.columns;
}

// The rows a card of count entries shows: every page keeps the rows the first page fills, so the
// card keeps its size from page to page.
export function achievementsRows(count: number): number {
  return Math.ceil(Math.min(achievementsPerPage(), count) / ACHIEVEMENTS_CARD.columns);
}

// The layout properties achievements.css reads for a card of count entries.
export function achievementsCardProperties(count: number): LayoutValues {
  const { gap, padding } = CARD_CONTENT;
  return {
    "--achievements-column-gap": padding,
    "--achievements-column-width": ACHIEVEMENTS_CARD.columnWidth,
    "--achievements-columns": ACHIEVEMENTS_CARD.columns,
    "--achievements-entry-height": ENTRY_HEIGHT,
    "--achievements-icon": ACHIEVEMENTS_CARD.icon,
    "--achievements-icon-gap": gap,
    "--achievements-row-gap": gap,
    "--achievements-rows": achievementsRows(count),
  };
}
