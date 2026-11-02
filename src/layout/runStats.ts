import { fillNames } from "@andornaut/game-kit/lines";
import { type BitmapFont, laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";
import { bitmapMeasure, fitsRoom, fittingText } from "@andornaut/game-kit/text/textFit";

import { SCREEN } from "../data/screen";
import type { Point, Rect } from "../data/types";
import { timeText } from "../save/runSummary";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { CARD_CONTENT, type CardFonts, cardTextSize } from "./contentCard";

export const RUN_STAT_KEYS = ["attempts", "lastAttempt", "best"] as const;
export const STATS_DIVIDER_HEIGHT = 2;
export interface StatsMetricRow {
  readonly label: string;
  readonly value: string;
}
export type RunStatWords = Readonly<Record<(typeof RUN_STAT_KEYS)[number], string>>;
export const STAGE_PREVIEW_SIZE = { height: 84, width: 168 } as const;

export interface StatsTotalsSnapshot {
  readonly stageSeconds: number;
  readonly zoneSeconds: number;
  readonly runSeconds: number;
}

export function statsTotalRows(
  templates: Readonly<Record<"stageTotal" | "zoneTotal" | "runTotal", string>>,
  totals: StatsTotalsSnapshot,
): readonly { readonly label: string; readonly value: string }[] {
  return (
    [
      ["stageTotal", totals.stageSeconds],
      ["zoneTotal", totals.zoneSeconds],
      ["runTotal", totals.runSeconds],
    ] as const
  ).map(([key, seconds]) => ({
    label: fillNames(templates[key], { time: "" }).trimEnd(),
    value: timeText(seconds),
  }));
}

export function runStatLines(words: RunStatWords): readonly string[] {
  return RUN_STAT_KEYS.map((key) => words[key]);
}

export function wrappedCardText(font: BitmapFont, width: number, text: string): string {
  const measure = bitmapMeasure(font);
  const fitted = fittingText(
    { lines: Math.floor(SCREEN.height / CARD_CONTENT.lineHeight), scale: CARD_TEXT_SCALE },
    measure,
    width,
    text,
  );
  if (!fitsRoom(measure, width, fitted)) {
    throw new Error(`Text cannot fit ${width}px: ${text}`);
  }
  return fitted.lines.join("\n");
}

export interface SummaryWords {
  readonly aggregate: string;
  readonly stage: string;
  readonly stats: readonly StatsMetricRow[];
  readonly totals: readonly StatsMetricRow[];
}

export function runStatLabels(templates: RunStatWords): RunStatWords {
  return Object.fromEntries(
    RUN_STAT_KEYS.map((key) => {
      const start = templates[key].indexOf("{");
      if (start < 0) {
        throw new Error(`Missing metric placeholder: ${key}`);
      }
      return [key, templates[key].slice(0, start).trimEnd()];
    }),
  ) as unknown as RunStatWords;
}

// Full-page summary text aligns its visible ink to the top-left of its measured slot.
export function summaryTextOrigin(font: BitmapFont, rect: Rect, text: string): Point {
  const lefts = text
    .split("\n")
    .flatMap((line) =>
      laidGlyphs(font, CARD_TEXT_SCALE, line).flatMap(({ ink }) => (ink ? [ink.left] : [])),
    );
  const tops = [...(text.split("\n")[0] ?? "")].flatMap((char) => {
    const glyph = font.glyphs.get(char);
    return glyph && glyph.width > 0 && glyph.height > 0 ? [glyph.yOffset * CARD_TEXT_SCALE] : [];
  });
  return {
    x: rect.x - (lefts.length ? Math.min(...lefts) : 0),
    y: rect.y - (tops.length ? Math.min(...tops) : 0),
  };
}

export function stageSummaryLayout(fonts: CardFonts, bounds: Rect, words: SummaryWords) {
  const padding = CARD_CONTENT.padding;
  const headingHeight = 2 * CARD_CONTENT.lineHeight;
  const imageWidth = STAGE_PREVIEW_SIZE.width + 4 * padding;
  const panelWidth = (bounds.width - imageWidth - 2 * padding) / 2;
  const room = panelWidth - 2 * padding;
  const block = (x: number, titleText: string, rows: readonly StatsMetricRow[]) => {
    if (rows.length !== RUN_STAT_KEYS.length) {
      throw new Error("Stage summary requires three rows in each statistics group");
    }
    const labelWidth = Math.max(...rows.map((row) => cardTextSize(fonts.body, row.label).width));
    const valueRoom = room - labelWidth - CARD_CONTENT.gap;
    const contentHeight =
      headingHeight +
      CARD_CONTENT.rowGap +
      rows.length * CARD_CONTENT.lineHeight +
      (rows.length - 1) * CARD_CONTENT.rowGap;
    const panel: Rect = { height: contentHeight + 2 * padding, width: panelWidth, x, y: bounds.y };
    const heading = wrappedCardText(fonts.body, room, titleText);
    if (cardTextSize(fonts.body, heading).height > headingHeight) {
      throw new Error(`Stage summary heading exceeds two lines: ${titleText}`);
    }
    const title: Rect = {
      height: headingHeight,
      width: room,
      x: x + padding,
      y: bounds.y + padding,
    };
    return {
      panel,
      rows: rows.map((row, index) => {
        if (valueRoom <= 0 || cardTextSize(fonts.body, row.value).width > valueRoom) {
          throw new Error(`Stage summary metric exceeds its column: ${row.label}`);
        }
        const rect: Rect = {
          height: CARD_CONTENT.lineHeight,
          width: room,
          x: title.x,
          y:
            title.y +
            headingHeight +
            CARD_CONTENT.rowGap +
            index * (CARD_CONTENT.lineHeight + CARD_CONTENT.rowGap),
        };
        return {
          label: { rect: { ...rect, width: labelWidth }, text: row.label },
          rect,
          value: {
            rect: { ...rect, width: valueRoom, x: rect.x + labelWidth + CARD_CONTENT.gap },
            text: row.value,
          },
        };
      }),
      text: heading,
      title,
    };
  };
  const stage = block(bounds.x, words.stage, words.stats);
  const image: Rect = {
    height: (imageWidth * STAGE_PREVIEW_SIZE.height) / STAGE_PREVIEW_SIZE.width,
    width: imageWidth,
    x: bounds.x + panelWidth + padding,
    y: bounds.y + padding,
  };
  const aggregate = block(image.x + image.width + padding, words.aggregate, words.totals);
  const bottom = Math.max(
    stage.panel.y + stage.panel.height,
    aggregate.panel.y + aggregate.panel.height,
    image.y + image.height,
  );
  if (bottom > bounds.y + bounds.height) {
    throw new Error("Stage summary exceeds the footer reservation");
  }
  const divider: Rect = {
    height: bottom - bounds.y,
    width: STATS_DIVIDER_HEIGHT,
    x: aggregate.panel.x - padding / 2 - STATS_DIVIDER_HEIGHT / 2,
    y: bounds.y,
  };
  return { aggregate, divider, image, stage };
}
