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
  readonly labels: { readonly stage: RunStatWords; readonly zone: RunStatWords };
  readonly wholeRun: string;
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
  const padding = CARD_CONTENT.padding;
  const headingHeight = 2 * CARD_CONTENT.lineHeight;
  const contentHeight =
    headingHeight +
    CARD_CONTENT.rowGap +
    RUN_STAT_KEYS.length * CARD_CONTENT.lineHeight +
    (RUN_STAT_KEYS.length - 1) * CARD_CONTENT.rowGap;
  const imageWidth = STAGE_PREVIEW_SIZE.width + 4 * padding;
  const panelWidth = (bounds.width - imageWidth - 2 * padding) / 2;
  const room = panelWidth - 2 * padding;
  const labelWidth = Math.max(
    ...Object.values(words.labels).flatMap((labels) =>
      RUN_STAT_KEYS.map((key) => cardTextSize(fonts.body, labels[key]).width),
    ),
  );
  const valueRoom = room - labelWidth - CARD_CONTENT.gap;
  const panelHeight = contentHeight + 2 * padding;
  if (
    valueRoom <= 0 ||
    panelHeight + CARD_CONTENT.rowGap + CARD_CONTENT.lineHeight > bounds.height
  ) {
    throw new Error("Stage summary has no room for full-size metrics");
  }
  const top = bounds.y;
  const block = (
    x: number,
    titleText: string,
    metrics: RunStatWords,
    labels: RunStatWords,
    font: BitmapFont,
  ) => {
    const panel: Rect = { height: panelHeight, width: panelWidth, x, y: top };
    const heading = wrappedCardText(font, room, titleText);
    if (cardTextSize(font, heading).height > headingHeight) {
      throw new Error(`Stage summary heading exceeds two lines: ${titleText}`);
    }
    const title = { height: headingHeight, width: room, x: x + padding, y: top + padding };
    const rows = RUN_STAT_KEYS.map((key, index) => {
      const text = metrics[key],
        label = labels[key];
      if (!text.startsWith(label)) {
        throw new Error(`Metric label mismatch: ${key}`);
      }
      const value = text.slice(label.length).trimStart();
      if (cardTextSize(fonts.body, value).width > valueRoom) {
        throw new Error(`Stage summary metric exceeds its column: ${key}`);
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
        label: { rect: { ...rect, width: labelWidth }, text: label },
        rect,
        text,
        value: {
          rect: { ...rect, width: valueRoom, x: rect.x + labelWidth + CARD_CONTENT.gap },
          text: value,
        },
      };
    });
    return { panel, rows, text: heading, title };
  };
  const zone = words.visit
    ? block(bounds.x, words.zone, words.visit, words.labels.zone, fonts.title)
    : undefined;
  const image: Rect = {
    height: (imageWidth * STAGE_PREVIEW_SIZE.height) / STAGE_PREVIEW_SIZE.width,
    width: imageWidth,
    x: bounds.x + panelWidth + padding,
    y: top + padding,
  };
  const stage = block(
    image.x + image.width + padding,
    words.stage,
    words.run,
    words.labels.stage,
    fonts.body,
  );
  if (cardTextSize(fonts.body, words.wholeRun).width > bounds.width) {
    throw new Error("Whole-run summary exceeds the page width");
  }
  const wholeRun = {
    rect: {
      height: CARD_CONTENT.lineHeight,
      width: bounds.width,
      x: bounds.x,
      y: top + panelHeight + CARD_CONTENT.rowGap,
    },
    text: words.wholeRun,
  };
  return { image, stage, wholeRun, zone };
}
