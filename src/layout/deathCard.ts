import type { Rect } from "../data/types";
import {
  CARD_CONTENT,
  cardActions,
  cardActionsSize,
  type CardFonts,
  cardTextSize,
  contentCardLayout,
} from "./contentCard";
import { hitAround } from "./hitAreas";
import { wrappedCardText } from "./runStats";

export const DEATH_PROGRESS_HEIGHT = 2;

export interface DeathCardWords {
  readonly home: string;
  readonly progress: string;
  readonly retry: string;
  readonly stage: string;
  readonly stats: readonly { readonly label: string; readonly value: string }[];
  readonly title: string;
}

export function deathCard(fonts: CardFonts, bounds: Rect, words: DeathCardWords) {
  const labels = [words.home, words.retry];
  const closeHit = hitAround({
    height: CARD_CONTENT.closeSize,
    width: CARD_CONTENT.closeSize,
    x: CARD_CONTENT.closeInset,
    y: CARD_CONTENT.closeInset,
  });
  const titleReserve = Math.max(
    CARD_CONTENT.padding,
    closeHit.x + closeHit.width + CARD_CONTENT.gap,
  );
  const innerWidth = bounds.width - 2 * CARD_CONTENT.padding;
  const texts = [words.title, words.stage, words.progress].map((text, index) =>
    wrappedCardText(
      index === 0 ? fonts.title : fonts.body,
      bounds.width - 2 * (index === 0 ? titleReserve : CARD_CONTENT.padding),
      text,
    ),
  );
  const rows = texts.map((text, index) =>
    cardTextSize(index === 0 ? fonts.title : fonts.body, text),
  );
  const valueWidth = Math.min(
    innerWidth / 2,
    Math.max(...words.stats.map((row) => cardTextSize(fonts.body, row.value).width)),
  );
  const stats = words.stats.map((row) => {
    const label = wrappedCardText(
      fonts.body,
      innerWidth - valueWidth - CARD_CONTENT.gap,
      row.label,
    );
    const value = wrappedCardText(fonts.body, valueWidth, row.value);
    return {
      label,
      labelSize: cardTextSize(fonts.body, label),
      value,
      valueSize: cardTextSize(fonts.body, value),
    };
  });
  const labelWidth = Math.max(...stats.map((row) => row.labelSize.width));
  const measuredValueWidth = Math.max(...stats.map((row) => row.valueSize.width));
  const groups = [
    {
      height:
        rows.reduce((sum, row) => sum + row.height, 0) + (rows.length - 1) * CARD_CONTENT.rowGap,
      key: "rows",
      width: Math.max(
        ...rows.map(
          (row, index) => row.width + (index === 0 ? 2 * (titleReserve - CARD_CONTENT.padding) : 0),
        ),
      ),
    },
    {
      height:
        stats.reduce((sum, row) => sum + Math.max(row.labelSize.height, row.valueSize.height), 0) +
        (stats.length - 1) * CARD_CONTENT.rowGap,
      key: "stats",
      width: labelWidth + CARD_CONTENT.gap + measuredValueWidth,
    },
    { key: "actions", ...cardActionsSize(fonts.body, "row", labels) },
  ];
  const layout = {
    ...contentCardLayout(bounds, groups),
    rows,
    stats,
    texts,
    titleReserve,
  };
  const rowGroup = layout.groups.rows;
  const actionGroup = layout.groups.actions;
  const statGroup = layout.groups.stats;
  if (!rowGroup || !actionGroup || !statGroup) {
    throw new Error("Missing death card content");
  }
  let y = rowGroup.y;
  const positions = layout.rows.map(({ height }) => {
    const row = { height, width: rowGroup.width, x: rowGroup.x, y };
    y += height + CARD_CONTENT.rowGap;
    return row;
  });
  const [home, retry] = cardActions(fonts.body, "row", actionGroup, labels);
  if (!home || !retry || !positions[0] || !positions[1] || !positions[2]) {
    throw new Error("Missing death card rows or actions");
  }
  let statY = statGroup.y;
  return {
    card: layout.card,
    home,
    progress: positions[2],
    retry,
    stage: positions[1],
    stageText: layout.texts[1] as string,
    stats: layout.stats.map((row) => {
      const height = Math.max(row.labelSize.height, row.valueSize.height);
      const rect = { height, width: statGroup.width, x: statGroup.x, y: statY };
      const at = statY;
      statY += height + CARD_CONTENT.rowGap;
      return {
        label: {
          rect: { height, width: row.labelSize.width, x: statGroup.x, y: at },
          text: row.label,
        },
        rect,
        value: {
          rect: {
            height,
            width: row.valueSize.width,
            x: statGroup.x + statGroup.width - row.valueSize.width,
            y: at,
          },
          text: row.value,
        },
      };
    }),
    title: {
      ...positions[0],
      width: layout.card.width - 2 * layout.titleReserve,
      x: layout.card.x + layout.titleReserve,
    },
    titleText: layout.texts[0] as string,
  };
}
