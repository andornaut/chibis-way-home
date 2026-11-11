import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { DIALOGUE_LAYOUT, SKILL_HUD, TEXT_BUTTON } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import type { DialogueSpeaker, Point, Rect } from "../../data/types";
import type { DialogueControl } from "../dialogue/conversation";
import type { CardFonts } from "./contentCard";
import { FONT_SCALE } from "./fontRoles";
import type { PressArea } from "./hitAreas";
import { type LabelledButton, labelledButton } from "./restartCard";

const {
  footer,
  nameTab: TAB,
  padding: PADDING,
  panel,
  portraitInset: PORTRAIT_INSET,
} = DIALOGUE_LAYOUT;
// The name tab's top, the top of everything the panel draws: the clearance below the top button
// row, whose skill HUD targets stay live above it.
const TAB_TOP = SKILL_HUD.inset + SKILL_HUD.target + TAB.clearance;
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

// How many body lines the column holds under each header: a bold heading takes the first line.
export function dialogueBodyLines(header: "heading" | "name-tab"): number {
  return DIALOGUE_SCREEN.text.lines - (header === "heading" ? 1 : 0);
}

// The text column's rows, centred down the panel by measured ink: the first row's ink top to the
// last row's ink bottom, over bodyCount body lines and the heading when there is one. Origins
// are BitmapText pens.
export function dialogueTextRows(
  fonts: CardFonts,
  header: "heading" | "name-tab",
  bodyCount: number,
): { readonly bodyY: number; readonly headingY?: number } {
  const { pitch, scale } = DIALOGUE_SCREEN.text;
  if (bodyCount < 1 || bodyCount > dialogueBodyLines(header)) {
    throw new Error(`The dialogue panel holds no ${bodyCount}-line ${header} paragraph`);
  }
  const body = fontInk(fonts.body, scale);
  const heading = header === "heading";
  const top = heading ? fontInk(fonts.title, scale).top : body.top;
  const rows = bodyCount + (heading ? 1 : 0);
  const height = (rows - 1) * pitch + body.bottom - top;
  const firstY = BOX.y + Math.round((BOX.height - height) / 2 - top);
  if (!heading) {
    if (firstY + body.top < TAB_TOP + TAB.height) {
      throw new Error("The dialogue name tab overlaps the first line");
    }
    return { bodyY: firstY };
  }
  return { bodyY: firstY + pitch, headingY: firstY };
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

// The panel's one press area: the panel and, when one shows, the name tab.
export function dialoguePressAreas(tab: Rect | undefined): readonly PressArea<"continue">[] {
  return [BOX, ...(tab === undefined ? [] : [tab])].map((hit) => ({
    art: BOX,
    hit,
    key: "continue" as const,
  }));
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

// The compact footer below the panel: secondary Skip left, primary Continue right, with equal
// face sizes.
export function dialogueButtons(
  labels: Readonly<Record<DialogueControl, number>>,
): Readonly<Record<DialogueControl, LabelledButton>> {
  return placedDialogueButtons(BOX.x + BOX.width, BOX.y + BOX.height + footer.gap, labels);
}

export function departureDialogueButtons(
  labels: Readonly<Record<DialogueControl, number>>,
): Readonly<Record<DialogueControl, LabelledButton>> {
  const inset = DIALOGUE_LAYOUT.departureInset;
  return placedDialogueButtons(SCREEN.width - inset, SCREEN.height - inset - footer.height, labels);
}

function placedDialogueButtons(
  right: number,
  y: number,
  labels: Readonly<Record<DialogueControl, number>>,
): Readonly<Record<DialogueControl, LabelledButton>> {
  const width = Math.max(
    DIALOGUE_LAYOUT.buttonWidth,
    labels.continue + 2 * TEXT_BUTTON.inset,
    labels.skip + 2 * TEXT_BUTTON.inset,
  );
  const groupWidth = 2 * width + TEXT_BUTTON.gap;
  if (groupWidth > DIALOGUE_SCREEN.box.width) {
    throw new Error("Dialogue action labels do not fit the footer");
  }
  const button = (x: number) => labelledButton({ height: footer.height, width, x, y });
  return {
    continue: button(right - width),
    skip: button(right - groupWidth),
  };
}
