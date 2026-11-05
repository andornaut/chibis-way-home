import { wrapWords } from "@andornaut/game-kit/lines";
import { modalWidth } from "@andornaut/game-kit/modalLayout";
import { insetRect } from "@andornaut/game-kit/rect";
import { type BitmapFont, inkWidth } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN } from "../../data/screen";
import type { Point, Rect, Size } from "../../data/types";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_CONTENT, CARD_TEXT_SCALE } from "./cardFrame";
import { FONT_METRICS, FONT_NATIVE_SIZE } from "./fontRoles";
import { hitAround, hitMargin } from "./hitAreas";
import { type LabelledButton, labelledButton } from "./labelledButton";
import { textInkBounds } from "./textInk";

export interface CardFonts {
  readonly body: BitmapFont;
  readonly title: BitmapFont;
}

export { CARD_CONTENT } from "./cardFrame";
type CardAxis = "row" | "stack";

interface CardGroup extends Size {
  readonly hitOutset?: number;
  // The distance from the group's top to its first visible content: text ink, or a drawn face.
  readonly inkTop?: number;
  readonly key: string;
}

// Modal titles use the main-heading role: measured at its display size, with its declared line
// height rather than the scaled atlas pitch.
export const CARD_HEADING = {
  lineHeight: FONT_METRICS.mainHeading.lineHeight,
  scale: FONT_METRICS.mainHeading.size / FONT_NATIVE_SIZE,
} as const;

// A title wrapped at the heading size: its lines joined by newlines, its measured box, and the
// bottom of its ink centred in that box.
export interface CardTitle extends Size {
  readonly inkBottom: number;
  readonly text: string;
}

export type CardTitleLayout = Rect & { readonly text: string };

interface CardHeader {
  readonly close: boolean;
  readonly font: BitmapFont;
  readonly title: string;
}

interface ContentCardLayout {
  readonly card: Rect;
  readonly close?: { readonly art: Rect; readonly at: Point; readonly hit: Rect };
  readonly groups: Readonly<Record<string, Rect>>;
  readonly title?: CardTitleLayout;
}

const CLOSE_ART: Rect = {
  height: CARD_CONTENT.closeSize,
  width: CARD_CONTENT.closeSize,
  x: CARD_CONTENT.closeInset,
  y: CARD_CONTENT.closeInset,
};
const CLOSE_HIT = hitAround(CLOSE_ART);

// The horizontal clearance on each side of a centred title: the full positioned close target plus
// the gap, mirrored, or the ordinary padding without a close control.
export function cardTitleReserve(close: boolean): number {
  return close
    ? Math.max(CARD_CONTENT.padding, CLOSE_HIT.x + CLOSE_HIT.width + CARD_CONTENT.gap)
    : CARD_CONTENT.padding;
}

// Where the first group starts below the card's top. With a header, its first visible content
// sits the title ink gap below the title's ink. The group's box also stays a gap below the title
// line, and its expanded press area a gap below the close target. Whole pixels, never closer.
export function cardBodyTop(
  close: boolean,
  first: Pick<CardGroup, "hitOutset" | "inkTop"> | undefined,
  title: CardTitle | undefined,
): number {
  const { gap, padding, titleInkGap } = CARD_CONTENT;
  if (!title && !close) {
    return padding;
  }
  return Math.max(
    title ? padding + title.height + gap : 0,
    close ? CLOSE_HIT.y + CLOSE_HIT.height + gap + (first?.hitOutset ?? 0) : 0,
    title && first?.inkTop !== undefined
      ? Math.ceil(padding + title.inkBottom + titleInkGap - first.inkTop)
      : 0,
  );
}

// Wrap a title at the heading size within width. Text never shrinks: a word wider than width
// throws.
export function cardTitleText(font: BitmapFont, width: number, text: string): CardTitle {
  const { lineHeight, scale } = CARD_HEADING;
  const measure = (line: string) => inkWidth(font, scale, line);
  const lines = text.split("\n").flatMap((paragraph) => wrapWords(measure, width, paragraph));
  if (lines.some((line) => measure(line) > width)) {
    throw new Error(`Title cannot fit ${width}px: ${text}`);
  }
  const wrapped = lines.join("\n");
  const height =
    (lines.length - 1) * lineHeight +
    Math.max(
      lineHeight,
      ...lines.map((line) => textInkBounds(font, scale, lineHeight, line).height),
    );
  const ink = textInkBounds(font, scale, lineHeight, wrapped);
  return {
    height,
    inkBottom: (height - ink.height) / 2 + ink.height,
    text: wrapped,
    width: Math.max(0, ...lines.map(measure)),
  };
}

// Text's measured box, and the top of its ink as cardTextOrigin centres it in that box.
export function cardTextSize(font: BitmapFont, text: string): Size & { readonly inkTop: number } {
  const lines = text.split("\n");
  const pitch = font.lineHeight * CARD_TEXT_SCALE;
  const height =
    (lines.length - 1) * pitch +
    Math.max(
      CARD_CONTENT.lineHeight,
      ...lines.map((line) => textInkBounds(font, CARD_TEXT_SCALE, pitch, line).height),
    );
  return {
    height,
    inkTop: (height - textInkBounds(font, CARD_TEXT_SCALE, pitch, text).height) / 2,
    width: Math.max(0, ...lines.map((line) => inkWidth(font, CARD_TEXT_SCALE, line))),
  };
}

export function cardActionsSize(
  font: BitmapFont,
  axis: CardAxis,
  labels: readonly string[],
): Size & { readonly hitOutset?: number; readonly inkTop?: number } {
  if (labels.length === 0) {
    return { height: 0, width: 0 };
  }
  const width =
    Math.max(...labels.map((label) => cardTextSize(font, label).width)) + 2 * TEXT_BUTTON.inset;
  const hitOutset = hitMargin({ height: TEXT_BUTTON.height, width, x: 0, y: 0 });
  return axis === "row"
    ? {
        height: TEXT_BUTTON.height,
        hitOutset,
        inkTop: 0,
        width: labels.length * width + (labels.length - 1) * CARD_CONTENT.gap,
      }
    : {
        height: labels.length * TEXT_BUTTON.height + (labels.length - 1) * CARD_CONTENT.rowGap,
        hitOutset,
        inkTop: 0,
        width,
      };
}

// The game adapter accepts measured groups, keeping measurement and placement independent of
// scene objects. Absent groups create neither space nor a gap.
export function contentCardLayout(
  bounds: Rect,
  groups: readonly CardGroup[],
  header?: CardHeader,
): ContentCardLayout {
  if (
    groups.some(
      ({ height, width }) =>
        ![height, width].every((value) => Number.isFinite(value) && value >= 0),
    )
  ) {
    throw new Error("Invalid card group size");
  }
  const present = groups.filter(({ height }) => height > 0);
  const close = header?.close === true;
  const titleReserve = cardTitleReserve(close);
  const titleText =
    header && header.title.length > 0
      ? cardTitleText(header.font, bounds.width - 2 * titleReserve, header.title)
      : undefined;
  const hasHeader = titleText !== undefined || close;
  const bodyTop = cardBodyTop(close, present[0], titleText);
  const headerWidth = titleText ? titleText.width + 2 * (titleReserve - CARD_CONTENT.padding) : 0;
  const contentWidth = Math.max(headerWidth, 0, ...present.map(({ width }) => width));
  const width = modalWidth(
    { availableWidth: bounds.width, viewportWidth: SCREEN.width },
    contentWidth,
  );
  const innerWidth = width - 2 * CARD_CONTENT.padding;
  const height =
    (present.length > 0 || !hasHeader ? bodyTop : bodyTop - CARD_CONTENT.gap) +
    present.reduce((sum, group) => sum + group.height, 0) +
    Math.max(0, present.length - 1) * CARD_CONTENT.gap +
    CARD_CONTENT.padding;
  if (innerWidth < contentWidth || height > bounds.height) {
    throw new Error("Card content exceeds the view");
  }
  const card: Rect = {
    height,
    width,
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
  };
  const inner = insetRect(CARD_CONTENT.padding, card);
  const innerX = inner.x;
  let y = inner.y;
  const positions: Record<string, Rect> = {};
  let title: CardTitleLayout | undefined;
  let closeLayout: ContentCardLayout["close"];
  if (hasHeader) {
    if (titleText) {
      title = {
        height: titleText.height,
        text: titleText.text,
        width: width - 2 * titleReserve,
        x: card.x + titleReserve,
        y,
      };
    }
    if (close) {
      const art = {
        ...CLOSE_ART,
        x: card.x + card.width - CLOSE_ART.x - CLOSE_ART.width,
        y: card.y + CLOSE_ART.y,
      };
      closeLayout = { art, at: { x: art.x, y: art.y }, hit: hitAround(art) };
    }
  }
  y = card.y + bodyTop;
  present.forEach((group, index) => {
    if (group.key in positions) {
      throw new Error(`Duplicate card group ${group.key}`);
    }
    positions[group.key] = {
      height: group.height,
      width: group.width,
      x: innerX + (innerWidth - group.width) / 2,
      y,
    };
    y += group.height + (index < present.length - 1 ? CARD_CONTENT.gap : 0);
  });
  return {
    card,
    ...(closeLayout && { close: closeLayout }),
    groups: positions,
    ...(title && { title }),
  };
}

export function cardActions(
  font: BitmapFont,
  axis: CardAxis,
  rect: Rect,
  labels: readonly string[],
): LabelledButton[] {
  const size = cardActionsSize(font, axis, labels);
  const width =
    axis === "row"
      ? (size.width - Math.max(0, labels.length - 1) * CARD_CONTENT.gap) /
        Math.max(1, labels.length)
      : size.width;
  return labels.map((_, index) =>
    labelledButton({
      height: TEXT_BUTTON.height,
      width,
      x: rect.x + (axis === "row" ? index * (width + CARD_CONTENT.gap) : 0),
      y: rect.y + (axis === "stack" ? index * (TEXT_BUTTON.height + CARD_CONTENT.rowGap) : 0),
    }),
  );
}

// Centre visible ink instead of the font's advance, side bearings or line-height padding.
export function cardTextOrigin(font: BitmapFont, rect: Rect, text: string): Point {
  return inkOrigin(font, CARD_TEXT_SCALE, font.lineHeight * CARD_TEXT_SCALE, rect, text);
}

// The same centring for a title at the heading size and line height.
export function cardTitleOrigin(font: BitmapFont, rect: Rect, text: string): Point {
  return inkOrigin(font, CARD_HEADING.scale, CARD_HEADING.lineHeight, rect, text);
}

function inkOrigin(
  font: BitmapFont,
  scale: number,
  linePitch: number,
  rect: Rect,
  text: string,
): Point {
  const ink = textInkBounds(font, scale, linePitch, text);
  return {
    x: rect.x + (rect.width - ink.width) / 2 - ink.x,
    y: rect.y + (rect.height - ink.height) / 2 - ink.y,
  };
}
