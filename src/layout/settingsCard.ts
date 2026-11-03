import { SCREEN } from "../data/screen";
import type { GameText, Point, Rect } from "../data/types";
import {
  CARD_CONTENT,
  cardActionsSize,
  type CardFonts,
  cardTextSize,
  contentCardLayout,
} from "./contentCard";
import { hitAround, hitMargin } from "./hitAreas";
import { labelledButton } from "./labelledButton";

const ICON = 16;
const SWITCH = { height: 16, width: 32 };
const ROW_HEIGHT = 48;

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
        hitOutset: hitMargin({ height: ROW_HEIGHT, width: rowWidth, x: 0, y: 0 }),
        key: "rows",
        width: rowWidth,
      },
      { key: "build", ...cardTextSize(fonts.body, build) },
    ],
    { close: true, titleWidth: cardTextSize(fonts.title, words.title).width },
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
      hit: hitAround(rect),
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

export function stepsCard(fonts: CardFonts, title: string, texts: readonly string[]) {
  const widths = texts.map((text) => cardTextSize(fonts.body, text).width);
  const sizes = texts.map((text) => cardTextSize(fonts.body, text));
  const layout = contentCardLayout(
    { ...SCREEN, x: 0, y: 0 },
    sizes.map((size, index) => ({
      height: Math.max(ICON, size.height),
      key: String(index),
      width: ICON + CARD_CONTENT.gap + size.width,
    })),
    { close: true, titleWidth: cardTextSize(fonts.title, title).width },
  );
  return {
    card: layout.card,
    close: layout.close!,
    steps: texts.map((_, index) => {
      const rect = layout.groups[String(index)]!;
      return {
        glyph: { x: rect.x, y: rect.y + (rect.height - ICON) / 2 } satisfies Point,
        text: {
          height: rect.height,
          width: widths[index]!,
          x: rect.x + ICON + CARD_CONTENT.gap,
          y: rect.y,
        } satisfies Rect,
      };
    }),
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
