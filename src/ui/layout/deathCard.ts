import { CARD_CONTENT, DEATH_CARD } from "../../data/layout";
import type { Rect } from "../../data/types";
import {
  cardActions,
  cardActionsSize,
  type CardFonts,
  cardTextSize,
  cardTitleReserve,
  contentCardLayout,
} from "./contentCard";
import { RUN_STAT_KEYS, type StatsMetricRow, wrappedCardText } from "./runStats";

const STATS_DIVIDER_HEIGHT = DEATH_CARD.dividerWidth;

interface DeathCardWords {
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
  if (words.stats.length !== RUN_STAT_KEYS.length) {
    throw new Error("Retry statistics require all three stage metrics");
  }
  const stageMetrics = (["lastAttempt", "best", "attempts"] as const).map(
    (key) => words.stats[RUN_STAT_KEYS.indexOf(key)]!,
  );
  const statsInset = CARD_CONTENT.padding + CARD_CONTENT.gap;
  const statsPadding = statsInset - CARD_CONTENT.padding;
  const dividerGap = 2 * CARD_CONTENT.gap;
  const sectionPadding = CARD_CONTENT.gap;
  // The title keeps the closeable cards' mirrored reservation so every modal title centres alike.
  const titleReserve = cardTitleReserve(true);
  const innerWidth = bounds.width - 2 * statsInset;
  const header = { close: false, font: fonts.title, reserve: titleReserve, title: words.title };
  const texts = [words.stage, words.progress].map((text) =>
    wrappedCardText(fonts.body, bounds.width - 2 * CARD_CONTENT.padding, text),
  );
  const rows = texts.map((text) => cardTextSize(fonts.body, text));
  const columnLimit = (innerWidth - STATS_DIVIDER_HEIGHT - 2 * dividerGap) / 2;
  const columns = [stageMetrics, words.totals].map((metrics) => {
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
      inkTop: rows[0]!.inkTop,
      key: "rows",
      width: Math.max(...rows.map((row) => row.width)),
    },
    {
      height: Math.max(...columns.map((column) => column.height)) + 2 * sectionPadding,
      key: "stats",
      width: 2 * columnWidth + STATS_DIVIDER_HEIGHT + 2 * dividerGap + 2 * statsPadding,
    },
    { key: "actions", ...cardActionsSize(fonts.title, "row", labels) },
  ];
  const base = contentCardLayout(bounds, groups, header);
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
    ...contentCardLayout(bounds, groups, header),
    rows,
    texts,
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
  const [home, retry] = cardActions(fonts.title, "row", actionGroup, labels);
  if (!home || !retry || !positions[0] || !positions[1] || !layout.title) {
    throw new Error("Missing death card rows or actions");
  }
  const divider: Rect = {
    height: statGroup.height - 2 * sectionPadding,
    width: STATS_DIVIDER_HEIGHT,
    x: statGroup.x + statsPadding + columnWidth + dividerGap,
    y: statGroup.y + sectionPadding,
  };
  const placedStats = columns.flatMap((column, index) => {
    const x =
      statGroup.x + statsPadding + index * (columnWidth + STATS_DIVIDER_HEIGHT + 2 * dividerGap);
    let y = statGroup.y + sectionPadding;
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
    progress: positions[1],
    retry,
    stage: positions[0],
    stageText: layout.texts[0] as string,
    statement:
      statement !== undefined && layout.groups.statement
        ? { rect: layout.groups.statement, text: statement }
        : undefined,
    stats: placedStats,
    title: layout.title,
  };
}
