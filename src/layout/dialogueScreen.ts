import { containsPoint } from "@andornaut/game-kit/rect";

import { SCREEN } from "../data/screen";
import type { DialogueSpeaker, Point, Rect } from "../data/types";
import type { DialogueControl } from "../dialogue/conversation";
import { TEXT_BUTTON } from "./buttonLabel";
import { type PressArea, pressedArea } from "./hitAreas";
import { type LabelledButton, labelledButton } from "./restartCard";

const BUTTON_WIDTH = 192;
const NAME_TAB_Y = 13;

// One top paragraph panel. Portraits are repositioned by speaker; neither asset is mirrored.
export const DIALOGUE_SCREEN = {
  box: { height: 96, width: 640, x: 40, y: 8 } satisfies Rect,
  text: { lines: 3, pitch: 20, scale: 2, width: 504, y: 42 },
} as const;

export function dialogueSpeakerLayout(side: DialogueSpeaker["side"]) {
  const left = side === "left";
  return {
    name: { x: left ? 130 : 90, y: 10 } satisfies Point,
    nameTabX: left ? 124 : 84,
    portrait: { x: left ? 50 : 606, y: 24 } satisfies Point,
    portraitFrame: { x: left ? 48 : 604, y: 22 } satisfies Point,
    textX: left ? 128 : 88,
  };
}

export function dialogueNameTab(side: DialogueSpeaker["side"], nameWidth: number): Rect {
  return {
    height: 20,
    width: nameWidth + 12,
    x: dialogueSpeakerLayout(side).nameTabX,
    y: NAME_TAB_Y,
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

export function liveDialogueContains(
  controls: readonly PressArea<DialogueControl>[],
  point: Point,
): boolean {
  return (
    containsPoint(DIALOGUE_SCREEN.box, point.x, point.y) ||
    pressedArea(controls, point) !== undefined
  );
}
