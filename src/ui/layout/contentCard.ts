import { wrapWords } from "@andornaut/game-kit/lines";
import { modalWidth } from "@andornaut/game-kit/modalLayout";
import { insetRect } from "@andornaut/game-kit/rect";
import { type BitmapFont, inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import { STACK_BUTTON_GAP } from "@andornaut/game-kit/ui/spacing";

import { CARD_CONTENT, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Point, Rect, Size } from "../../data/types/index.ts";
import { CARD_TEXT_SCALE } from "./cardFrame.ts";
import { FONT_METRICS, FONT_NATIVE_SIZE } from "./fontRoles.ts";
import { hitAround, hitMargin } from "./hitAreas.ts";
import { type LabelledButton, labelledButton } from "./labelledButton.ts";
import { textInkBounds } from "./textInk.ts";

export interface CardFonts {
  readonly body: BitmapFont;
  readonly title: BitmapFont;
}

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

// A title wrapped at the heading size: its lines joined by newlines, and its measured box.
export interface CardTitle extends Size {
  readonly text: string;
}

export type CardTitleLayout = Rect & { readonly text: string };

interface CardHeader {
  readonly close: boolean;
  readonly font: BitmapFont;
  // The title's horizontal clearance on each side, when it differs from cardTitleReserve(close).
  readonly reserve?: number;
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

// Where the title and the first group start below the card's top. The visible gap from the
// title's ink to the first group's visible content equals the gap from the frame's inner top edge
// to the title's ink. The title starts at the top padding unless the close target's clearance
// pushes the first group lower; then the title moves down to keep both gaps equal. The first group
// starts on a whole pixel.
export function cardHeaderLayout(
  close: boolean,
  first: Pick<CardGroup, "hitOutset" | "inkTop"> | undefined,
  title: CardTitle | undefined,
): { readonly bodyTop: number; readonly titleTop: number } {
  const { frameBorder, gap, padding } = CARD_CONTENT;
  const closeClearance = close ? CLOSE_HIT.y + CLOSE_HIT.height + gap : 0;
  if (!title) {
    return {
      bodyTop: close ? closeClearance + (first?.hitOutset ?? 0) : padding,
      titleTop: padding,
    };
  }
  if (!first) {
    return {
      bodyTop: Math.max(padding + title.height, closeClearance - gap) + gap,
      titleTop: padding,
    };
  }
  const inkTop = first.inkTop ?? 0;
  // Balanced at the top padding: content ink sits as far below the title ink as the title ink sits
  // below the frame.
  const balanced = 2 * padding - frameBorder + title.height - inkTop;
  const bodyTop = Math.ceil(
    Math.max(balanced, close ? closeClearance + (first.hitOutset ?? 0) : 0),
  );
  return {
    bodyTop,
    titleTop: (bodyTop + inkTop + frameBorder - title.height) / 2,
  };
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
  return {
    height,
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
        width: labels.length * width + (labels.length - 1) * TEXT_BUTTON.gap,
      }
    : {
        height: labels.length * TEXT_BUTTON.height + (labels.length - 1) * STACK_BUTTON_GAP,
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
  const titleReserve = header?.reserve ?? cardTitleReserve(close);
  const titleText =
    header && header.title.length > 0
      ? cardTitleText(header.font, bounds.width - 2 * titleReserve, header.title)
      : undefined;
  const hasHeader = titleText !== undefined || close;
  const { bodyTop, titleTop } = cardHeaderLayout(close, present[0], titleText);
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
  const innerX = insetRect(CARD_CONTENT.padding, card).x;
  let y: number;
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
        y: card.y + titleTop,
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
      ? (size.width - Math.max(0, labels.length - 1) * TEXT_BUTTON.gap) / Math.max(1, labels.length)
      : size.width;
  return labels.map((_, index) =>
    labelledButton({
      height: TEXT_BUTTON.height,
      width,
      x: rect.x + (axis === "row" ? index * (width + TEXT_BUTTON.gap) : 0),
      y: rect.y + (axis === "stack" ? index * (TEXT_BUTTON.height + STACK_BUTTON_GAP) : 0),
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
