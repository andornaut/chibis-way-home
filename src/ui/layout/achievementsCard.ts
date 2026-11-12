import type { LayoutValues } from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { ACHIEVEMENTS_CARD, CARD_CONTENT, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { capTop, FONT_METRICS, UI_FONT_FACE } from "./fontRoles.ts";
import { hitAround } from "./hitAreas.ts";

// The Achievements card's geometry in base px (src/ui/dom/achievements.css lays it out): its
// title over two columns of entries filled down each column then across, a page at a time, and
// Previous, the page count and Next below them.

// One entry's height: its title line and its description's lines, each a body line box.
const ENTRY_HEIGHT = FONT_METRICS.body.lineHeight * (1 + ACHIEVEMENTS_CARD.descriptionLines);

// The close X's press area, at the card's top right.
const CLOSE_HIT = hitAround({
  height: CARD_CONTENT.closeSize,
  width: CARD_CONTENT.closeSize,
  x: CARD_CONTENT.closeInset,
  y: CARD_CONTENT.closeInset,
});

// The top of the list's first line below the card's top edge. The title's cap height sits midway
// between the frame's inner top edge and the first entry title's cap top, as far from each as the
// card's padding inside the frame, unless the list must start lower to keep the gap below the
// close X's press area; the title then moves down to stay midway.
export function achievementsListTop(): number {
  const { frameBorder, gap, padding } = CARD_CONTENT;
  const balanced =
    frameBorder +
    2 * (padding - frameBorder) +
    UI_FONT_FACE.capHeight * FONT_METRICS.mainHeading.size -
    capTop(FONT_METRICS.body);
  return Math.max(balanced, CLOSE_HIT.y + CLOSE_HIT.height + gap);
}

// How many entries one page holds: two columns of as many rows as fit the view between the
// card's title and its pager.
export function achievementsPerPage(): number {
  const { gap, padding } = CARD_CONTENT;
  const room = SCREEN.height - achievementsListTop() - gap - TEXT_BUTTON.height - padding;
  const rows = Math.floor((room + gap) / (ENTRY_HEIGHT + gap));
  if (rows < 1) {
    throw new Error("No achievement row fits the view");
  }
  return rows * ACHIEVEMENTS_CARD.columns;
}

// The layout properties achievements.css reads for a card of count entries: every page keeps the
// rows the first page fills, so the card keeps its size from page to page.
export function achievementsCardProperties(count: number): LayoutValues {
  const { frameBorder, gap, padding } = CARD_CONTENT;
  const perPage = achievementsPerPage();
  return {
    "--achievements-cap-top": capTop(FONT_METRICS.body),
    "--achievements-column-gap": padding,
    "--achievements-column-width": ACHIEVEMENTS_CARD.columnWidth,
    "--achievements-columns": ACHIEVEMENTS_CARD.columns,
    "--achievements-entry-height": ENTRY_HEIGHT,
    // From the frame's inner top edge to the first entry title's cap top.
    "--achievements-header": achievementsListTop() + capTop(FONT_METRICS.body) - frameBorder,
    "--achievements-icon": ACHIEVEMENTS_CARD.icon,
    "--achievements-icon-gap": gap,
    "--achievements-row-gap": gap,
    "--achievements-rows": Math.ceil(Math.min(perPage, count) / ACHIEVEMENTS_CARD.columns),
  };
}
