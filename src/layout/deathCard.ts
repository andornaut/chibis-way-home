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
import { STATS_DIVIDER_HEIGHT, type StatsMetricRow, wrappedCardText } from "./runStats";

export const DEATH_PROGRESS_HEIGHT = 2;

export interface DeathCardWords {
  readonly home: string;
  readonly progress: string;
  readonly retry: string;
  readonly stage: string;
  readonly statement?: string;
  readonly stats: readonly StatsMetricRow[];
  readonly totals: readonly StatsMetricRow[];
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
  const columnLimit = (innerWidth - STATS_DIVIDER_HEIGHT - 2 * CARD_CONTENT.gap) / 2;
  const columns = [words.stats, words.totals].map((metrics) => {
    const valueWidth = Math.min(
      columnLimit / 2,
      Math.max(0, ...metrics.map((row) => cardTextSize(fonts.body, row.value).width)),
    );
    const rows = metrics.map((row) => {
      const label = wrappedCardText(
        fonts.body,
        columnLimit - valueWidth - CARD_CONTENT.gap,
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
    return {
      height:
        rows.reduce((sum, row) => sum + Math.max(row.labelSize.height, row.valueSize.height), 0) +
        Math.max(0, rows.length - 1) * CARD_CONTENT.rowGap,
      rows,
      width:
        Math.max(0, ...rows.map((row) => row.labelSize.width)) +
        CARD_CONTENT.gap +
        Math.max(0, ...rows.map((row) => row.valueSize.width)),
    };
  });
  const columnWidth = Math.max(...columns.map((column) => column.width));
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
      height: Math.max(...columns.map((column) => column.height)),
      key: "stats",
      width: 2 * columnWidth + STATS_DIVIDER_HEIGHT + 2 * CARD_CONTENT.gap,
    },
    { key: "actions", ...cardActionsSize(fonts.body, "row", labels) },
  ];
  const base = contentCardLayout(bounds, groups);
  const statementCardWidth =
    words.statement === undefined
      ? base.card.width
      : Math.min(
          bounds.width,
          Math.max(
            base.card.width,
            cardTextSize(fonts.body, words.statement).width + 2 * CARD_CONTENT.padding,
          ),
        );
  const statement =
    words.statement === undefined
      ? undefined
      : wrappedCardText(fonts.body, statementCardWidth - 2 * CARD_CONTENT.padding, words.statement);
  if (statement !== undefined) {
    groups.splice(1, 0, {
      ...cardTextSize(fonts.body, statement),
      key: "statement",
      width: statementCardWidth - 2 * CARD_CONTENT.padding,
    });
  }
  const layout = {
    ...contentCardLayout(bounds, groups),
    rows,
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
  const divider: Rect = {
    height: statGroup.height,
    width: STATS_DIVIDER_HEIGHT,
    x: statGroup.x + columnWidth + CARD_CONTENT.gap,
    y: statGroup.y,
  };
  const placedStats = columns.flatMap((column, index) => {
    const x = statGroup.x + index * (columnWidth + STATS_DIVIDER_HEIGHT + 2 * CARD_CONTENT.gap);
    let y = statGroup.y;
    return column.rows.map((row) => {
      const height = Math.max(row.labelSize.height, row.valueSize.height);
      const rect = { height, width: columnWidth, x, y };
      y += height + CARD_CONTENT.rowGap;
      return {
        label: {
          rect: { height, width: row.labelSize.width, x, y: rect.y },
          text: row.label,
        },
        rect,
        value: {
          rect: {
            height,
            width: row.valueSize.width,
            x: x + columnWidth - row.valueSize.width,
            y: rect.y,
          },
          text: row.value,
        },
      };
    });
  });
  return {
    card: layout.card,
    divider,
    home,
    progress: positions[2],
    retry,
    stage: positions[1],
    stageText: layout.texts[1] as string,
    statement:
      statement !== undefined && layout.groups.statement
        ? { rect: layout.groups.statement, text: statement }
        : undefined,
    stats: placedStats,
    title: {
      ...positions[0],
      width: layout.card.width - 2 * layout.titleReserve,
      x: layout.card.x + layout.titleReserve,
    },
    titleText: layout.texts[0] as string,
  };
}
