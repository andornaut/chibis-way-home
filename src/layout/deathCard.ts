import { insetRect, rectAboveIn } from "@andornaut/game-kit/rect";

import type { Rect, Size } from "../data/types";
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

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Try the preferred top position first, then every separating edge around the visible bird.
export function deathCardPosition(bounds: Rect, size: Size, bird: Rect): Rect {
  const avoid = insetRect(-CARD_CONTENT.gap, bird);
  const top = bounds.y + CARD_CONTENT.padding;
  const centre = bounds.x + bounds.width / 2;
  const preferred = rectAboveIn(bounds, { bottom: top + size.height, x: centre }, size);
  const above = rectAboveIn(bounds, { bottom: avoid.y, x: centre }, size);
  const xs = [
    preferred.x,
    bounds.x,
    bounds.x + bounds.width - size.width,
    avoid.x - size.width,
    avoid.x + avoid.width,
  ];
  const ys = [
    preferred.y,
    above.y,
    avoid.y + avoid.height,
    bounds.y + bounds.height - size.height,
    bounds.y,
  ];
  for (const y of ys) {
    for (const x of xs) {
      const candidate = rectAboveIn(
        bounds,
        { bottom: y + size.height, x: x + size.width / 2 },
        size,
      );
      if (!overlaps(candidate, avoid)) {
        return candidate;
      }
    }
  }
  throw new Error("Death card cannot fit clear of the bird");
}

export function deathCard(fonts: CardFonts, bounds: Rect, bird: Rect, words: DeathCardWords) {
  const labels = [words.home, words.retry];
  const fit = (available: Rect) => {
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
    const innerWidth = available.width - 2 * CARD_CONTENT.padding;
    const texts = [words.title, words.stage, words.progress].map((text, index) =>
      wrappedCardText(
        index === 0 ? fonts.title : fonts.body,
        available.width - 2 * (index === 0 ? titleReserve : CARD_CONTENT.padding),
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
            (row, index) =>
              row.width + (index === 0 ? 2 * (titleReserve - CARD_CONTENT.padding) : 0),
          ),
        ),
      },
      {
        height:
          stats.reduce(
            (sum, row) => sum + Math.max(row.labelSize.height, row.valueSize.height),
            0,
          ) +
          (stats.length - 1) * CARD_CONTENT.rowGap,
        key: "stats",
        width: labelWidth + CARD_CONTENT.gap + measuredValueWidth,
      },
      { key: "actions", ...cardActionsSize(fonts.body, "row", labels) },
    ];
    try {
      const measured = contentCardLayout(available, groups);
      const position = deathCardPosition(available, measured.card, bird);
      return {
        ...contentCardLayout(available, groups, undefined, position),
        rows,
        stats,
        texts,
        titleReserve,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        ["Card content exceeds the view", "Death card cannot fit clear of the bird"].includes(
          error.message,
        )
      ) {
        return undefined;
      }
      throw error;
    }
  };
  // A centred body can leave no full-minimum-width placement. Its clearance then defines the
  // safe available rectangle, so the shared maximum-width clamp still preserves visible content.
  const avoid = insetRect(-CARD_CONTENT.gap, bird);
  const left = Math.max(bounds.x, Math.min(bounds.x + bounds.width, avoid.x));
  const right = Math.max(bounds.x, Math.min(bounds.x + bounds.width, avoid.x + avoid.width));
  const top = Math.max(bounds.y, Math.min(bounds.y + bounds.height, avoid.y));
  const bottom = Math.max(bounds.y, Math.min(bounds.y + bounds.height, avoid.y + avoid.height));
  const clear = [
    { ...bounds, width: left - bounds.x },
    { ...bounds, width: bounds.x + bounds.width - right, x: right },
    { ...bounds, height: top - bounds.y },
    { ...bounds, height: bounds.y + bounds.height - bottom, y: bottom },
  ];
  const layout =
    fit(bounds) ??
    clear.reduce<ReturnType<typeof fit>>(
      (found, available) =>
        found ?? (available.width > 0 && available.height > 0 ? fit(available) : undefined),
      undefined,
    );
  if (!layout) {
    throw new Error("Death card cannot fit clear of the bird");
  }
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
