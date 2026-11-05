import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN } from "../../data/screen";
import type { DialogueSpeaker, Point, Rect } from "../../data/types";
import type { DialogueControl } from "../dialogue/conversation";
import { TEXT_BUTTON } from "./buttonLabel";
import { CARD_CONTENT } from "./cardFrame";
import type { CardFonts } from "./contentCard";
import { FONT_SCALE } from "./fontRoles";
import { type LabelledButton, labelledButton } from "./restartCard";

const BUTTON_WIDTH = 192;

const BOX = { height: 96, width: 640, x: 40, y: 8 } satisfies Rect;
// Clear space between the panel's edge, the portrait frame and the text column's measured ink.
const PADDING = CARD_CONTENT.gap;
const PORTRAIT_FRAME = 68;
const PORTRAIT_INSET = 2;
const TAB_HEIGHT = 20;

// One top paragraph panel. Portraits are repositioned by speaker; neither asset is mirrored.
export const DIALOGUE_SCREEN = {
  box: BOX,
  padding: PADDING,
  text: {
    lines: 3,
    pitch: 20,
    scale: FONT_SCALE,
    width: BOX.width - 3 * PADDING - PORTRAIT_FRAME,
  },
} as const;

// The portrait frame sits PADDING from its side and centred down the panel; the text column
// fills the rest, PADDING from the frame and the far side.
export function dialogueSpeakerLayout(side: DialogueSpeaker["side"]) {
  const left = side === "left";
  const frameX = left ? BOX.x + PADDING : BOX.x + BOX.width - PADDING - PORTRAIT_FRAME;
  const frameY = BOX.y + (BOX.height - PORTRAIT_FRAME) / 2;
  return {
    portrait: { x: frameX + PORTRAIT_INSET, y: frameY + PORTRAIT_INSET } satisfies Point,
    portraitFrame: { height: PORTRAIT_FRAME, width: PORTRAIT_FRAME, x: frameX, y: frameY },
    textX: left ? frameX + PORTRAIT_FRAME + PADDING : BOX.x + PADDING,
  };
}

// The text column's rows, by measured ink. A name tab over three body lines spans the panel
// between its top and bottom padding, the tab's gap to the first line taking what remains; a bold
// heading over two lines centres down the panel. Origins are BitmapText pens.
export function dialogueTextRows(fonts: CardFonts, header: "heading" | "name-tab") {
  const { lines, pitch, scale } = DIALOGUE_SCREEN.text;
  const body = fontInk(fonts.body, scale);
  if (header === "name-tab") {
    const tabY = BOX.y + PADDING;
    const bodyY = BOX.y + BOX.height - PADDING - (lines - 1) * pitch - body.bottom;
    if (bodyY + body.top < tabY + TAB_HEIGHT) {
      throw new Error("The dialogue name tab overlaps the first line");
    }
    return { bodyLines: lines, bodyY, tabY };
  }
  const title = fontInk(fonts.title, scale);
  const height = (lines - 1) * pitch + body.bottom - title.top;
  const headingY = Math.round(BOX.y + (BOX.height - height) / 2 - title.top);
  return { bodyLines: lines - 1, bodyY: headingY + pitch, headingY };
}

export function dialogueNameTab(
  side: DialogueSpeaker["side"],
  tabY: number,
  nameWidth: number,
): Rect {
  return {
    height: TAB_HEIGHT,
    width: nameWidth + 12,
    x: dialogueSpeakerLayout(side).textX,
    y: tabY,
  };
}

// The highest ink top and lowest ink bottom of any drawn glyph, relative to the pen.
function fontInk(
  font: BitmapFont,
  scale: number,
): { readonly bottom: number; readonly top: number } {
  const drawn = [...font.glyphs.values()].filter(({ height, width }) => width > 0 && height > 0);
  return {
    bottom: Math.max(...drawn.map(({ height, yOffset }) => (yOffset + height) * scale)),
    top: Math.min(...drawn.map(({ yOffset }) => yOffset * scale)),
  };
}

// Footer below the panel: secondary Skip left, primary Continue right, with equal face sizes.
export function dialogueButtons(
  labels: Readonly<Record<DialogueControl, number>>,
): Readonly<Record<DialogueControl, LabelledButton>> {
  return placedDialogueButtons(DIALOGUE_SCREEN.box.x + DIALOGUE_SCREEN.box.width, 112, labels);
}

export function departureDialogueButtons(
  labels: Readonly<Record<DialogueControl, number>>,
): Readonly<Record<DialogueControl, LabelledButton>> {
  return placedDialogueButtons(SCREEN.width - 16, SCREEN.height - 16 - TEXT_BUTTON.height, labels);
}

function placedDialogueButtons(
  right: number,
  y: number,
  labels: Readonly<Record<DialogueControl, number>>,
): Readonly<Record<DialogueControl, LabelledButton>> {
  const width = Math.max(
    BUTTON_WIDTH,
    labels.continue + 2 * TEXT_BUTTON.inset,
    labels.skip + 2 * TEXT_BUTTON.inset,
  );
  const groupWidth = 2 * width + TEXT_BUTTON.gap;
  if (groupWidth > DIALOGUE_SCREEN.box.width) {
    throw new Error("Dialogue action labels do not fit the footer");
  }
  const button = (x: number) => labelledButton({ height: TEXT_BUTTON.height, width, x, y });
  return {
    continue: button(right - width),
    skip: button(right - groupWidth),
  };
}
