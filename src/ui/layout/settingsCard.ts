import { SCREEN } from "../../data/screen";
import type { GameText, Point, Rect } from "../../data/types";
import {
  CARD_CONTENT,
  cardActionsSize,
  type CardFonts,
  cardTextSize,
  contentCardLayout,
} from "./contentCard";
import { HIT_RULE } from "./hitAreas";
import { labelledButton } from "./labelledButton";
import { wrappedCardText } from "./runStats";

const ICON = 16;
const SWITCH = { height: 16, width: 32 };
// Each row is its own press target, already the minimum target height, so it gains no margin and
// the first row starts a gap below the header: the taller of the title line and the close
// target's clearance.
const ROW_HEIGHT = HIT_RULE.minTarget;

export function settingsCard(
  fonts: CardFonts,
  words: GameText["settings"],
  build: string,
  hasInstall: boolean,
) {
  const actionWidth = cardActionsSize(fonts.title, "row", [words.installButton]).width;
  const labelWidth = (label: string) => cardTextSize(fonts.body, label).width;
  const widths = [words.moveControls, words.actionButtons].map(
    (text) => ICON + CARD_CONTENT.gap + labelWidth(text) + CARD_CONTENT.gap + SWITCH.width,
  );
  if (hasInstall) {
    widths.push(
      ICON + CARD_CONTENT.gap + labelWidth(words.install) + CARD_CONTENT.gap + actionWidth,
    );
  }
  const rowWidth = Math.max(...widths);
  const rows = hasInstall ? 3 : 2;
  const layout = contentCardLayout(
    { ...SCREEN, x: 0, y: 0 },
    [
      {
        height: rows * ROW_HEIGHT + (rows - 1) * CARD_CONTENT.rowGap,
        // The first row's label ink, centred in its line slot in the middle of the row.
        inkTop:
          (ROW_HEIGHT - CARD_CONTENT.lineHeight) / 2 +
          cardTextSize(fonts.body, words.moveControls).inkTop,
        key: "rows",
        width: rowWidth,
      },
      { key: "build", ...cardTextSize(fonts.body, build) },
    ],
    { close: true, font: fonts.title, title: words.title },
  );
  const group = layout.groups.rows!;
  const row = (index: number, text: string) => {
    const rect = {
      height: ROW_HEIGHT,
      width: rowWidth,
      x: group.x,
      y: group.y + index * (ROW_HEIGHT + CARD_CONTENT.rowGap),
    };
    return {
      hit: rect,
      icon: { x: rect.x, y: rect.y + (ROW_HEIGHT - ICON) / 2 },
      label: {
        height: CARD_CONTENT.lineHeight,
        width: labelWidth(text),
        x: rect.x + ICON + CARD_CONTENT.gap,
        y: rect.y + (ROW_HEIGHT - CARD_CONTENT.lineHeight) / 2,
      },
      row: rect,
      toggle: { x: rect.x + rowWidth - SWITCH.width, y: rect.y + (ROW_HEIGHT - SWITCH.height) / 2 },
    };
  };
  const install = row(2, words.install);
  const button = labelledButton({
    height: ROW_HEIGHT,
    width: actionWidth,
    x: install.row.x + rowWidth - actionWidth,
    y: install.row.y,
  });
  return {
    actionButtons: row(1, words.actionButtons),
    buildLabel: { ...layout.groups.build!, centreX: layout.card.x + layout.card.width / 2 },
    card: layout.card,
    close: layout.close!,
    install: {
      ...install,
      button: button.button,
    },
    moveControls: row(0, words.moveControls),
    title: layout.title!,
  };
}

// Install steps wrap within this width beside their glyph, and the card grows to fit them.
const STEPS_TEXT_WIDTH = 320;

// The install steps card: the kind's title, and its steps beside their glyph.
export function stepsCard(fonts: CardFonts, title: string, steps: string) {
  const lines = wrappedCardText(fonts.body, STEPS_TEXT_WIDTH, steps);
  const size = cardTextSize(fonts.body, lines);
  const height = Math.max(ICON, size.height);
  const layout = contentCardLayout(
    { ...SCREEN, x: 0, y: 0 },
    [
      {
        height,
        inkTop: (height - size.height) / 2 + size.inkTop,
        key: "steps",
        width: ICON + CARD_CONTENT.gap + size.width,
      },
    ],
    { close: true, font: fonts.title, title },
  );
  const rect = layout.groups.steps!;
  return {
    card: layout.card,
    close: layout.close!,
    steps: {
      glyph: { x: rect.x, y: rect.y + (rect.height - ICON) / 2 } satisfies Point,
      lines,
      text: {
        height: rect.height,
        width: size.width,
        x: rect.x + ICON + CARD_CONTENT.gap,
        y: rect.y,
      } satisfies Rect,
    },
    title: layout.title!,
  };
}

// Art's keyboard focus ring, a 9-slice drawn this far outside the focused row, button or close X
// on every side.
const FOCUS_OUTSET = 4;

export function focusRingAround({ height, width, x, y }: Rect): Rect {
  return {
    height: height + 2 * FOCUS_OUTSET,
    width: width + 2 * FOCUS_OUTSET,
    x: x - FOCUS_OUTSET,
    y: y - FOCUS_OUTSET,
  };
}
