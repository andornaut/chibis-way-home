import { modalWidth } from "@andornaut/game-kit/modalLayout";
import { insetRect } from "@andornaut/game-kit/rect";
import { type BitmapFont, inkWidth } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN } from "../../data/screen";
import type { Point, Rect, Size } from "../../data/types";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_CONTENT, CARD_TEXT_SCALE } from "./cardFrame";
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
  readonly key: string;
}

interface CardHeader {
  readonly close: boolean;
  readonly titleWidth: number;
}

interface ContentCardLayout {
  readonly card: Rect;
  readonly close?: { readonly art: Rect; readonly at: Point; readonly hit: Rect };
  readonly groups: Readonly<Record<string, Rect>>;
  readonly title?: Rect;
}

export function cardTextSize(font: BitmapFont, text: string): Size {
  const lines = text.split("\n");
  return {
    height:
      (lines.length - 1) * font.lineHeight * CARD_TEXT_SCALE +
      Math.max(
        CARD_CONTENT.lineHeight,
        ...lines.map(
          (line) =>
            textInkBounds(font, CARD_TEXT_SCALE, font.lineHeight * CARD_TEXT_SCALE, line).height,
        ),
      ),
    width: Math.max(0, ...lines.map((line) => inkWidth(font, CARD_TEXT_SCALE, line))),
  };
}

export function cardActionsSize(
  font: BitmapFont,
  axis: CardAxis,
  labels: readonly string[],
): Size & { readonly hitOutset?: number } {
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
        width: labels.length * width + (labels.length - 1) * CARD_CONTENT.gap,
      }
    : {
        height: labels.length * TEXT_BUTTON.height + (labels.length - 1) * CARD_CONTENT.rowGap,
        hitOutset,
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
  const hasTitle = header !== undefined && header.titleWidth > 0;
  const hasHeader = hasTitle || close;
  const closeArt = {
    height: CARD_CONTENT.closeSize,
    width: CARD_CONTENT.closeSize,
    x: CARD_CONTENT.closeInset,
    y: CARD_CONTENT.closeInset,
  };
  const closeHit = hitAround(closeArt);
  const closeRight = closeHit.x + closeHit.width;
  const closeBottom = closeHit.y + closeHit.height;
  const titleReserve = close
    ? Math.max(CARD_CONTENT.padding, closeRight + CARD_CONTENT.gap)
    : CARD_CONTENT.padding;
  const headerHeight = hasHeader
    ? Math.max(
        hasTitle ? CARD_CONTENT.lineHeight : 0,
        close ? closeBottom - CARD_CONTENT.padding + (present[0]?.hitOutset ?? 0) : 0,
      )
    : 0;
  const headerWidth = hasTitle
    ? (header?.titleWidth ?? 0) + 2 * (titleReserve - CARD_CONTENT.padding)
    : 0;
  const contentWidth = Math.max(headerWidth, 0, ...present.map(({ width }) => width));
  const count = present.length + (hasHeader ? 1 : 0);
  const width = modalWidth(
    { availableWidth: bounds.width, viewportWidth: SCREEN.width },
    contentWidth,
  );
  const innerWidth = width - 2 * CARD_CONTENT.padding;
  const height =
    headerHeight +
    present.reduce((sum, group) => sum + group.height, 0) +
    Math.max(0, count - 1) * CARD_CONTENT.gap +
    2 * CARD_CONTENT.padding;
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
  let title: Rect | undefined;
  let closeLayout: ContentCardLayout["close"];
  if (hasHeader) {
    if (hasTitle) {
      title = {
        height: CARD_CONTENT.lineHeight,
        width: width - 2 * titleReserve,
        x: card.x + titleReserve,
        y,
      };
    }
    if (close) {
      const art = {
        ...closeArt,
        x: card.x + card.width - closeArt.x - closeArt.width,
        y: card.y + closeArt.y,
      };
      closeLayout = { art, at: { x: art.x, y: art.y }, hit: hitAround(art) };
    }
    y += headerHeight + (present.length > 0 ? CARD_CONTENT.gap : 0);
  }
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
  const ink = textInkBounds(font, CARD_TEXT_SCALE, font.lineHeight * CARD_TEXT_SCALE, text);
  return {
    x: rect.x + (rect.width - ink.width) / 2 - ink.x,
    y: rect.y + (rect.height - ink.height) / 2 - ink.y,
  };
}
