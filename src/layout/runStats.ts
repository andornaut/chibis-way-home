import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { bitmapMeasure, fitsRoom, fittingText } from "@andornaut/game-kit/text/textFit";

import { SCREEN } from "../data/screen";
import type { Rect } from "../data/types";
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
  readonly run: RunStatWords;
  readonly visit?: RunStatWords & { readonly partial: string | undefined };
}

export function stageSummaryLayout(fonts: CardFonts, bounds: Rect, words: SummaryWords) {
  const count = words.visit ? 2 : 1;
  const room = (bounds.width - STAGE_PREVIEW_SIZE.width - count * CARD_CONTENT.padding) / count;
  const block = (title: string, lines: readonly string[], titleFont: BitmapFont) => {
    const heading = wrappedCardText(titleFont, room, title);
    const rows = lines.map((text) => wrappedCardText(fonts.body, room, text));
    const headingSize = cardTextSize(titleFont, heading);
    const sizes = rows.map((text) => cardTextSize(fonts.body, text));
    return {
      heading,
      headingSize,
      height:
        headingSize.height +
        CARD_CONTENT.gap +
        sizes.reduce((sum, size) => sum + size.height, 0) +
        (sizes.length - 1) * CARD_CONTENT.rowGap,
      rows,
      sizes,
      width: Math.max(headingSize.width, ...sizes.map((size) => size.width)),
    };
  };
  const run = block(
    words.visit ? words.stage : `${words.zone}\n${words.stage}`,
    runStatLines(words.run),
    fonts.body,
  );
  const visit = words.visit
    ? block(
        words.zone,
        [...(words.visit.partial ? [words.visit.partial] : []), ...runStatLines(words.visit)],
        fonts.title,
      )
    : undefined;
  const height = Math.max(STAGE_PREVIEW_SIZE.height, run.height, visit?.height ?? 0);
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
  const left = bounds.x + (bounds.width - width) / 2;
  const top = bounds.y + (bounds.height - height) / 2;
  const image = {
    ...STAGE_PREVIEW_SIZE,
    x: left,
    y: top + (height - STAGE_PREVIEW_SIZE.height) / 2,
  };
  const placed = (value: typeof run, x: number) => {
    let y = top + (height - value.height) / 2;
    const title: Rect = { height: value.headingSize.height, width: value.width, x, y };
    y += title.height + CARD_CONTENT.gap;
    const rows = value.rows.map((text, index) => {
      const rect: Rect = {
        height: value.sizes[index]?.height ?? CARD_CONTENT.lineHeight,
        width: value.width,
        x,
        y,
      };
      y += rect.height + CARD_CONTENT.rowGap;
      return { rect, text };
    });
    return { rows, text: value.heading, title };
  };
  const stage = placed(run, image.x + image.width + CARD_CONTENT.padding);
  const zone = visit
    ? placed(visit, stage.title.x + stage.title.width + CARD_CONTENT.padding)
    : undefined;
  return { image, stage, zone };
}
