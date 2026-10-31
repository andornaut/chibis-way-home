import { type BitmapFont, laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";
import { bitmapMeasure, fitsRoom, fittingText } from "@andornaut/game-kit/text/textFit";

import { SCREEN } from "../data/screen";
import type { Point, Rect } from "../data/types";
import { CARD_TEXT_SCALE } from "./cardFrame";
import { CARD_CONTENT, type CardFonts, cardTextSize } from "./contentCard";

export const RUN_STAT_KEYS = ["lastAttempt", "runTotal", "best", "attempts"] as const;
export type RunStatWords = Readonly<Record<(typeof RUN_STAT_KEYS)[number], string>>;
export const STAGE_PREVIEW_SIZE = { height: 84, width: 168 } as const;

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
  readonly stage: string;
  readonly zone: string;
  readonly labels: RunStatWords;
  readonly run: RunStatWords;
  readonly visit?: RunStatWords & { readonly partial: string | undefined };
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
  const count = words.visit ? 2 : 1;
  const room = (bounds.width - STAGE_PREVIEW_SIZE.width - count * CARD_CONTENT.padding) / count;
  const labels = RUN_STAT_KEYS.map((key) => words.labels[key]);
  const labelWidth = Math.max(...labels.map((text) => cardTextSize(fonts.body, text).width));
  const valueRoom = room - labelWidth - CARD_CONTENT.gap;
  if (valueRoom <= 0) {
    throw new Error("Stage summary has no room for metric values");
  }
  const block = (title: string, metrics: RunStatWords, titleFont: BitmapFont, partial?: string) => {
    const heading = wrappedCardText(titleFont, room, title);
    const headingSize = cardTextSize(titleFont, heading);
    const subtitle = partial ? wrappedCardText(fonts.body, room, partial) : undefined;
    const subtitleSize = subtitle ? cardTextSize(fonts.body, subtitle) : undefined;
    const rows = RUN_STAT_KEYS.map((key, index) => {
      const text = metrics[key],
        label = labels[index]!;
      if (!text.startsWith(label)) {
        throw new Error(`Metric label mismatch: ${key}`);
      }
      const value = wrappedCardText(fonts.body, valueRoom, text.slice(label.length).trimStart());
      return { label, text, value, valueSize: cardTextSize(fonts.body, value) };
    });
    return {
      headerHeight:
        headingSize.height + (subtitleSize ? CARD_CONTENT.rowGap + subtitleSize.height : 0),
      heading,
      headingSize,
      rows,
      subtitle,
      subtitleSize,
      width: Math.max(
        headingSize.width,
        subtitleSize?.width ?? 0,
        labelWidth + CARD_CONTENT.gap + Math.max(...rows.map(({ valueSize }) => valueSize.width)),
      ),
    };
  };
  const run = block(
    words.visit ? words.stage : `${words.zone}\n${words.stage}`,
    words.run,
    fonts.body,
  );
  const visit = words.visit
    ? block(words.zone, words.visit, fonts.title, words.visit.partial)
    : undefined;
  const headerHeight = Math.max(run.headerHeight, visit?.headerHeight ?? 0);
  const rowHeights = run.rows.map((row, index) =>
    Math.max(
      CARD_CONTENT.lineHeight,
      row.valueSize.height,
      visit?.rows[index]?.valueSize.height ?? 0,
    ),
  );
  const height = Math.max(
    STAGE_PREVIEW_SIZE.height,
    headerHeight +
      CARD_CONTENT.gap +
      rowHeights.reduce((sum, n) => sum + n, 0) +
      (RUN_STAT_KEYS.length - 1) * CARD_CONTENT.rowGap,
  );
  const width =
    STAGE_PREVIEW_SIZE.width +
    CARD_CONTENT.padding +
    run.width +
    (visit ? CARD_CONTENT.padding + visit.width : 0);
  if (width > bounds.width || height > bounds.height) {
    throw new Error(
      `Stage summary ${width}x${height} exceeds ${bounds.width}x${bounds.height}: ${words.stage}`,
    );
  }
  const left = bounds.x + (bounds.width - width) / 2,
    top = bounds.y + (bounds.height - height) / 2;
  const image = { ...STAGE_PREVIEW_SIZE, x: left, y: top };
  const placed = (value: typeof run, x: number) => {
    const title: Rect = { height: value.headingSize.height, width: value.width, x, y: top };
    const subtitle =
      value.subtitle && value.subtitleSize
        ? {
            rect: {
              height: value.subtitleSize.height,
              width: value.width,
              x,
              y: top + title.height + CARD_CONTENT.rowGap,
            },
            text: value.subtitle,
          }
        : undefined;
    let y = top + headerHeight + CARD_CONTENT.gap;
    const rows = value.rows.map((row, index) => {
      const rect: Rect = { height: rowHeights[index]!, width: value.width, x, y };
      const label = { rect: { ...rect, width: labelWidth }, text: row.label };
      const metric = {
        rect: {
          ...rect,
          width: value.width - labelWidth - CARD_CONTENT.gap,
          x: x + labelWidth + CARD_CONTENT.gap,
        },
        text: row.value,
      };
      y += rect.height + CARD_CONTENT.rowGap;
      return { label, rect, text: row.text, value: metric };
    });
    return { rows, subtitle, text: value.heading, title };
  };
  const stage = placed(run, image.x + image.width + CARD_CONTENT.padding);
  const zone = visit
    ? placed(visit, stage.title.x + stage.title.width + CARD_CONTENT.padding)
    : undefined;
  return { image, stage, zone };
}
