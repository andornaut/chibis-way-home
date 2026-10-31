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

export const DEATH_PROGRESS_HEIGHT = 2;

export interface DeathCardWords {
  readonly home: string;
  readonly progress: string;
  readonly retry: string;
  readonly stage: string;
  readonly time: string;
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
  const names = ["title", "stage", "progress", "time"] as const;
  const rows = names.map((name) =>
    cardTextSize(name === "title" ? fonts.title : fonts.body, words[name]),
  );
  const labels = [words.home, words.retry];
  const groups = [
    {
      height:
        rows.reduce((sum, row) => sum + row.height, 0) + (rows.length - 1) * CARD_CONTENT.rowGap,
      key: "rows",
      width: Math.max(...rows.map(({ width }) => width)),
    },
    { key: "actions", ...cardActionsSize(fonts.body, "row", labels) },
  ];
  const fit = (available: Rect) => {
    try {
      const measured = contentCardLayout(available, groups);
      const position = deathCardPosition(available, measured.card, bird);
      return contentCardLayout(available, groups, undefined, position);
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
  if (!rowGroup || !actionGroup) {
    throw new Error("Missing death card content");
  }
  let y = rowGroup.y;
  const positions = rows.map(({ height }) => {
    const row = { height, width: rowGroup.width, x: rowGroup.x, y };
    y += height + CARD_CONTENT.rowGap;
    return row;
  });
  const [home, retry] = cardActions(fonts.body, "row", actionGroup, labels);
  if (!home || !retry || !positions[0] || !positions[1] || !positions[2] || !positions[3]) {
    throw new Error("Missing death card rows or actions");
  }
  return {
    card: layout.card,
    home,
    progress: positions[2],
    retry,
    stage: positions[1],
    time: positions[3],
    title: positions[0],
  };
}
