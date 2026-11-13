import { CARD_CONTENT } from "../../data/layout.ts";
import type { Rect, Size } from "../../data/types/index.ts";
import { hitAround } from "./hitAreas.ts";

// Title geometry supplied by the native layout's declared type role.
export interface CardTitle extends Size {
  readonly text: string;
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
  first: { readonly hitOutset?: number; readonly inkTop?: number } | undefined,
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
