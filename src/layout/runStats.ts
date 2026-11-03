import { fillNames } from "@andornaut/game-kit/lines";
import { type BitmapFont, laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";
import { bitmapMeasure, fitsRoom, fittingText } from "@andornaut/game-kit/text/textFit";

import { SCREEN } from "../data/screen";
import type { Point, Rect } from "../data/types";
import type { DialogueParagraph } from "../dialogue/conversation";
import { timeText } from "../save/runSummary";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { CARD_CONTENT, type CardFonts } from "./contentCard";
import { FONT_METRICS, FONT_NATIVE_SIZE } from "./fontRoles";
import { textInkBounds } from "./textInk";

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
  readonly progress: string;
  readonly stage: string;
  readonly statement?: Pick<DialogueParagraph, "colour" | "name" | "text"> | undefined;
  readonly stats: readonly StatsMetricRow[];
  readonly totals: readonly StatsMetricRow[];
  readonly zone: string;
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
export function summaryTextOrigin(
  font: BitmapFont,
  rect: Rect,
  text: string,
  scale = CARD_TEXT_SCALE,
): Point {
  const lefts = text
    .split("\n")
    .flatMap((line) => laidGlyphs(font, scale, line).flatMap(({ ink }) => (ink ? [ink.left] : [])));
  const tops = [...(text.split("\n")[0] ?? "")].flatMap((char) => {
    const glyph = font.glyphs.get(char);
    return glyph && glyph.width > 0 && glyph.height > 0 ? [glyph.yOffset * scale] : [];
  });
  return {
    x: rect.x - (lefts.length ? Math.min(...lefts) : 0),
    y: rect.y - (tops.length ? Math.min(...tops) : 0),
  };
}

const SUMMARY_PREVIEW_HEIGHT = 120;
const SUMMARY_COLUMN_WIDTH = 152;

export function stageSummaryLayout(fonts: CardFonts, bounds: Rect, words: SummaryWords) {
  const ink = (
    font: BitmapFont,
    text: string,
    scale = CARD_TEXT_SCALE,
    lineHeight = font.lineHeight * scale,
  ) => textInkBounds(font, scale, lineHeight, text);
  const centred = (
    font: BitmapFont,
    y: number,
    text: string,
    scale = CARD_TEXT_SCALE,
    lineHeight = font.lineHeight * scale,
  ) => {
    const size = ink(font, text, scale, lineHeight);
    if (text.includes("\n") || size.width > bounds.width) {
      throw new Error(`Stage summary heading exceeds the page width: ${text}`);
    }
    return {
      lineHeight,
      rect: { ...size, x: bounds.x + (bounds.width - size.width) / 2, y },
      scale,
      text,
    };
  };
  const zone = centred(
    fonts.title,
    bounds.y,
    words.zone,
    FONT_METRICS.compactMainHeading.size / FONT_NATIVE_SIZE,
    FONT_METRICS.compactMainHeading.lineHeight,
  );
  const stage = centred(
    fonts.body,
    zone.rect.y + zone.rect.height + CARD_CONTENT.rowGap,
    words.stage,
  );
  const progress = centred(
    fonts.body,
    stage.rect.y + stage.rect.height + CARD_CONTENT.rowGap,
    words.progress,
  );
  const imageWidth =
    (SUMMARY_PREVIEW_HEIGHT * STAGE_PREVIEW_SIZE.width) / STAGE_PREVIEW_SIZE.height;
  const image: Rect = {
    height: SUMMARY_PREVIEW_HEIGHT,
    width: imageWidth,
    x: bounds.x + (bounds.width - imageWidth) / 2,
    y: progress.rect.y + progress.rect.height + CARD_CONTENT.rowGap,
  };
  const columnGap = 2 * CARD_CONTENT.padding;
  const groupWidth = 2 * SUMMARY_COLUMN_WIDTH + columnGap;
  const groupX = bounds.x + (bounds.width - groupWidth) / 2;
  const statsY = image.y + image.height + CARD_CONTENT.rowGap;
  const primary = (["lastAttempt", "best", "attempts"] as const).map((key) => {
    const row = words.stats[RUN_STAT_KEYS.indexOf(key)];
    if (!row) {
      throw new Error(`Missing current-stage statistic: ${key}`);
    }
    return row;
  });
  if (
    words.stats.length !== RUN_STAT_KEYS.length ||
    words.totals.length !== RUN_STAT_KEYS.length ||
    groupWidth > bounds.width
  ) {
    throw new Error("Stage summary requires two complete statistics columns");
  }
  const columns = [primary, words.totals].map((rows, column) =>
    rows.map((row, index) => {
      const label = ink(fonts.body, row.label);
      const value = ink(fonts.body, row.value);
      if (label.width + CARD_CONTENT.gap + value.width > SUMMARY_COLUMN_WIDTH) {
        throw new Error(`Stage summary metric exceeds its column: ${row.label}`);
      }
      const x = groupX + column * (SUMMARY_COLUMN_WIDTH + columnGap);
      const y = statsY + index * (CARD_CONTENT.lineHeight + CARD_CONTENT.rowGap);
      return {
        label: { rect: { ...label, x, y }, text: row.label },
        value: {
          rect: { ...value, x: x + SUMMARY_COLUMN_WIDTH - value.width, y },
          text: row.value,
        },
      };
    }),
  );
  const stats = columns[0]!;
  const totals = columns[1]!;
  const metricsBottom = Math.max(
    ...columns
      .flat()
      .flatMap((row) => [
        row.label.rect.y + row.label.rect.height,
        row.value.rect.y + row.value.rect.height,
      ]),
  );
  const statement =
    words.statement === undefined
      ? undefined
      : (() => {
          const nameText = `${words.statement.name}:`;
          const nameInk = ink(fonts.body, nameText);
          const textInk = ink(fonts.body, words.statement.text);
          const width = nameInk.width + CARD_CONTENT.gap + textInk.width;
          if (words.statement.text.includes("\n") || width > bounds.width) {
            throw new Error("Stage summary statement exceeds one full-size line");
          }
          const rect: Rect = {
            height: Math.max(nameInk.height, textInk.height),
            width,
            x: bounds.x + (bounds.width - width) / 2,
            y: metricsBottom + CARD_CONTENT.gap,
          };
          return {
            colour: words.statement.colour,
            name: { rect: { ...nameInk, x: rect.x, y: rect.y }, text: nameText },
            rect,
            text: {
              rect: { ...textInk, x: rect.x + nameInk.width + CARD_CONTENT.gap, y: rect.y },
              text: words.statement.text,
            },
          };
        })();
  if (
    Math.max(metricsBottom, statement ? statement.rect.y + statement.rect.height : 0) >
    bounds.y + bounds.height
  ) {
    throw new Error("Stage summary exceeds the footer reservation");
  }
  return { image, progress, stage, statement, stats, totals, zone };
}
