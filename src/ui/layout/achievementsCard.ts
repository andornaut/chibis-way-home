import { wrapWords } from "@andornaut/game-kit/lines";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN } from "../../data/screen";
import type { Point, Rect } from "../../data/types";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_TEXT_SCALE } from "./cardFrame";
import {
  CARD_CONTENT,
  cardActionsSize,
  cardBodyTop,
  type CardFonts,
  cardTextSize,
  cardTitleReserve,
  cardTitleText,
  contentCardLayout,
} from "./contentCard";
import { labelledButton } from "./labelledButton";
import { textInkBounds } from "./textInk";

// art's icon-achievement frame, drawn at its own size.
export const ACHIEVEMENT_ICON_SIZE = 16;
// The list's columns, the width of each and the gap between them.
const COLUMNS = 2;
const COLUMN_WIDTH = 312;
const COLUMN_GAP = CARD_CONTENT.padding;
// The icon's gap to its text, and the gap between a title and its progress.
const ICON_GAP = CARD_CONTENT.gap;
const PROGRESS_GAP = CARD_CONTENT.gap;
// Each entry's description takes at most this many lines.
const DESCRIPTION_LINES = 2;

// One entry's words: its title, description and, for a locked entry with progress, its count.
export interface AchievementWords {
  readonly description: string;
  readonly progress?: string;
  readonly title: string;
}

interface CardWords {
  readonly next: string;
  readonly page: string;
  readonly previous: string;
  readonly title: string;
}

// One entry in its page's slot: the icon's top-left, and the top-left of the title, of the
// progress count at the title line's right end, and of each description line, a line pitch
// apart.
export interface AchievementEntryLayout {
  readonly description: readonly { readonly at: Point; readonly text: string }[];
  readonly icon: Point;
  readonly progress?: Point;
  readonly slot: Rect;
  readonly title: Point;
}

const pitch = (fonts: CardFonts) => fonts.body.lineHeight * CARD_TEXT_SCALE;
const entryHeight = (fonts: CardFonts) => pitch(fonts) * (1 + DESCRIPTION_LINES);

// Entry titles are drawn from the slot's top: the highest title ink across every entry, so every
// page shares one list position.
function listInkTop(fonts: CardFonts, entries: readonly AchievementWords[]): number {
  return Math.min(
    ...entries.map(
      ({ title }) => textInkBounds(fonts.title, CARD_TEXT_SCALE, pitch(fonts), title).y,
    ),
  );
}

// How many entries one page holds: two columns of as many rows as fit the view beside the
// card's title and pager.
export function achievementsPerPage(
  fonts: CardFonts,
  words: CardWords,
  entries: readonly AchievementWords[],
): number {
  const pager = cardActionsSize(fonts.title, "row", [words.previous, words.next]);
  const title = cardTitleText(fonts.title, SCREEN.width - 2 * cardTitleReserve(true), words.title);
  const fixed =
    cardBodyTop(true, { inkTop: listInkTop(fonts, entries) }, title) +
    CARD_CONTENT.gap +
    pager.height +
    CARD_CONTENT.padding;
  const rows = Math.floor(
    (SCREEN.height - fixed + CARD_CONTENT.gap) / (entryHeight(fonts) + CARD_CONTENT.gap),
  );
  if (rows < 1) {
    throw new Error("No achievement row fits the view");
  }
  return rows * COLUMNS;
}

// The Achievements card: its centred title and close X, the list in page slots filled down each
// column then across, and Previous, the page count and Next below it. Every entry has its own
// slot on its page; page p shows entries p * perPage up to the next page's first.
export function achievementsCardLayout(
  fonts: CardFonts,
  words: CardWords,
  entries: readonly AchievementWords[],
) {
  if (entries.length === 0) {
    throw new Error("The Achievements card needs at least one entry");
  }
  const perPage = achievementsPerPage(fonts, words, entries);
  const pages = Math.ceil(entries.length / perPage);
  const shownRows = Math.ceil(Math.min(perPage, entries.length) / COLUMNS);
  const rowHeight = entryHeight(fonts);
  const textWidth = COLUMN_WIDTH - ACHIEVEMENT_ICON_SIZE - ICON_GAP;
  const pagerLabels = [words.previous, words.next];
  const pagerSize = cardActionsSize(fonts.title, "row", pagerLabels);
  const countText = words.page.replace("{page}", String(pages)).replace("{pages}", String(pages));
  const countSize = cardTextSize(fonts.body, countText);
  const layout = contentCardLayout(
    { ...SCREEN, x: 0, y: 0 },
    [
      {
        height: shownRows * rowHeight + (shownRows - 1) * CARD_CONTENT.gap,
        inkTop: listInkTop(fonts, entries),
        key: "list",
        width: COLUMNS * COLUMN_WIDTH + (COLUMNS - 1) * COLUMN_GAP,
      },
      {
        height: pagerSize.height,
        key: "pager",
        width: pagerSize.width + countSize.width + 2 * CARD_CONTENT.gap,
      },
    ],
    { close: true, font: fonts.title, title: words.title },
  );
  const list = layout.groups.list!;
  const pager = layout.groups.pager!;
  const buttonWidth = (pagerSize.width - CARD_CONTENT.gap) / 2;
  const pagerButton = (x: number) =>
    labelledButton({ height: TEXT_BUTTON.height, width: buttonWidth, x, y: pager.y });
  const placed = {
    count: {
      ...countSize,
      x: pager.x + (pager.width - countSize.width) / 2,
      y: pager.y + (pager.height - countSize.height) / 2,
    },
    next: pagerButton(pager.x + pager.width - buttonWidth),
    previous: pagerButton(pager.x),
  };
  const perColumn = perPage / COLUMNS;
  return {
    card: layout.card,
    close: layout.close!,
    entries: entries.map((words, index): AchievementEntryLayout => {
      const slot = index % perPage;
      const column = Math.floor(slot / perColumn);
      const row = slot % perColumn;
      const x = list.x + column * (COLUMN_WIDTH + COLUMN_GAP);
      const y = list.y + row * (rowHeight + CARD_CONTENT.gap);
      const textX = x + ACHIEVEMENT_ICON_SIZE + ICON_GAP;
      const lineHeight = pitch(fonts);
      const progressWidth =
        words.progress === undefined ? 0 : cardTextSize(fonts.body, words.progress).width;
      const titleRoom = textWidth - (progressWidth > 0 ? progressWidth + PROGRESS_GAP : 0);
      if (inkWidth(fonts.title, CARD_TEXT_SCALE, words.title) > titleRoom) {
        throw new Error(`Achievement title does not fit: ${words.title}`);
      }
      const lines = wrapWords(
        (line) => inkWidth(fonts.body, CARD_TEXT_SCALE, line),
        textWidth,
        words.description,
      );
      if (
        lines.length > DESCRIPTION_LINES ||
        lines.some((line) => inkWidth(fonts.body, CARD_TEXT_SCALE, line) > textWidth)
      ) {
        throw new Error(
          `Achievement description exceeds ${DESCRIPTION_LINES} lines: ${words.title}`,
        );
      }
      return {
        description: lines.map((text, line) => ({
          at: { x: textX, y: y + (line + 1) * lineHeight },
          text,
        })),
        icon: { x, y: y + (lineHeight - ACHIEVEMENT_ICON_SIZE) / 2 },
        ...(words.progress !== undefined && {
          progress: { x: textX + textWidth - progressWidth, y },
        }),
        slot: { height: rowHeight, width: COLUMN_WIDTH, x, y },
        title: { x: textX, y },
      };
    }),
    pager: placed,
    pages,
    perPage,
    title: layout.title!,
  };
}

// The unlock notice in the bark panel: the icon at twice its size and the notice's line, centred
// down the panel together.
export function achievementNoticeLayout(panel: Rect, fonts: CardFonts, text: string) {
  const icon = 2 * ACHIEVEMENT_ICON_SIZE;
  const size = cardTextSize(fonts.title, text);
  const width = icon + ICON_GAP + size.width;
  if (width > panel.width - 2 * CARD_CONTENT.padding) {
    throw new Error(`The achievement notice does not fit: ${text}`);
  }
  const x = panel.x + (panel.width - width) / 2;
  return {
    icon: { x, y: panel.y + (panel.height - icon) / 2 },
    iconScale: 2,
    text: {
      ...size,
      x: x + icon + ICON_GAP,
      y: panel.y + (panel.height - size.height) / 2,
    },
  };
}
