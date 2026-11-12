import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { DIALOGUE_LAYOUT, HUD_EDGE } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { DialogueSpeaker, Point, Rect } from "../../data/types/index.ts";
import type { CardFonts } from "./contentCard.ts";
import { FONT_SCALE } from "./fontRoles.ts";
import { SKILL_BUTTON } from "./skillHud.ts";

const { nameTab: TAB, padding: PADDING, panel, portraitInset: PORTRAIT_INSET } = DIALOGUE_LAYOUT;
// The name tab's top, the top of everything the panel draws: the clearance below the top button
// row's discs, whose skill HUD targets stay live above it.
const TAB_TOP = HUD_EDGE + SKILL_BUTTON.disc + TAB.clearance;
// The panel, centred across the view below the name tab's overhang.
const BOX: Rect = {
  ...panel,
  x: (SCREEN.width - panel.width) / 2,
  y: TAB_TOP + TAB.overhang,
};
// The portrait frame's side: the portrait and the frame's border around it.
const PORTRAIT_FRAME = DIALOGUE_LAYOUT.portrait + 2 * PORTRAIT_INSET;
const TEXT_GAP = DIALOGUE_LAYOUT.text.gap;

// A portrait's drawn side.
export const DIALOGUE_PORTRAIT_SIZE = DIALOGUE_LAYOUT.portrait;

// One top paragraph panel. Portraits are repositioned by speaker; neither asset is mirrored.
export const DIALOGUE_SCREEN = {
  box: BOX,
  padding: PADDING,
  text: {
    lines: DIALOGUE_LAYOUT.text.lines,
    pitch: DIALOGUE_LAYOUT.text.pitch,
    scale: FONT_SCALE,
    width: BOX.width - PADDING - PORTRAIT_FRAME - 2 * TEXT_GAP,
  },
} as const;

// The portrait frame sits PADDING inside its end of the panel; the text column fills the rest,
// TEXT_GAP from the frame and from the panel's far edge.
export function dialogueSpeakerLayout(side: DialogueSpeaker["side"]) {
  const left = side === "left";
  const frameX = left ? BOX.x + PADDING : BOX.x + BOX.width - PADDING - PORTRAIT_FRAME;
  const frameY = BOX.y + PADDING;
  return {
    portrait: { x: frameX + PORTRAIT_INSET, y: frameY + PORTRAIT_INSET } satisfies Point,
    portraitFrame: { height: PORTRAIT_FRAME, width: PORTRAIT_FRAME, x: frameX, y: frameY },
    textX: left ? frameX + PORTRAIT_FRAME + TEXT_GAP : BOX.x + TEXT_GAP,
  };
}

// The text column's body rows, centred down the panel by measured ink: the first row's ink top
// to the last row's ink bottom, over bodyCount lines. The origin is a BitmapText pen.
export function dialogueTextRows(fonts: CardFonts, bodyCount: number): { readonly bodyY: number } {
  const { lines, pitch, scale } = DIALOGUE_SCREEN.text;
  if (bodyCount < 1 || bodyCount > lines) {
    throw new Error(`The dialogue panel holds no ${bodyCount}-line paragraph`);
  }
  const body = fontInk(fonts.body, scale);
  const height = (bodyCount - 1) * pitch + body.bottom - body.top;
  const bodyY = BOX.y + Math.round((BOX.height - height) / 2 - body.top);
  if (bodyY + body.top < TAB_TOP + TAB.height) {
    throw new Error("The dialogue name tab overlaps the first line");
  }
  return { bodyY };
}

// The speaker's name tab: above the panel's top at the end opposite the portrait.
export function dialogueNameTab(side: DialogueSpeaker["side"], nameWidth: number): Rect {
  const width = nameWidth + 2 * TAB.inset;
  const tab = {
    height: TAB.height,
    width,
    x: side === "left" ? BOX.x + BOX.width - TAB.endInset - width : BOX.x + TAB.endInset,
    y: TAB_TOP,
  };
  const frame = dialogueSpeakerLayout(side).portraitFrame;
  if (side === "left" ? tab.x < frame.x + frame.width : tab.x + tab.width > frame.x) {
    throw new Error("The dialogue speaker name reaches over the portrait");
  }
  return tab;
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
