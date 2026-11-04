import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import type { Point, Rect } from "../../data/types";
import { textInkBounds } from "./textInk";

// Standard menu action geometry, shared by start-screen and card buttons.
export const TEXT_BUTTON = {
  gap: 8,
  height: 48,
  inset: 16,
  lipHeight: 4,
  pressedSink: 2,
  verticalInset: 12,
} as const;

// A mark drawn just before a button's label, such as Resume's play triangle: its width, and the
// gap from it to the label's ink.
export interface LabelMark {
  readonly gap: number;
  readonly height: number;
  readonly width: number;
}

// The native play mark and its gap from the label ink.
export const PLAY_MARK: LabelMark = { gap: 6, height: 10, width: 5 };

// Where a button's label starts, with its mark before it when it has one, so that the two are
// centred across the button as one group, retaining fractional native-font placement.
export function centredLabel(
  button: Rect,
  labelInk: number,
  mark?: Pick<LabelMark, "gap" | "width">,
): { readonly labelX: number; readonly markX?: number } {
  const lead = mark === undefined ? 0 : mark.width + (labelInk > 0 ? mark.gap : 0);
  const left = button.x + (button.width - lead - labelInk) / 2;
  return mark === undefined ? { labelX: left } : { labelX: left + lead, markX: left };
}

export type ButtonFaceState = "normal" | "pressed" | "disabled";
export function buttonFace(state: ButtonFaceState, button: Rect): Rect {
  return state === "disabled"
    ? button
    : {
        ...button,
        height: button.height - TEXT_BUTTON.lipHeight,
        y: button.y + (state === "pressed" ? TEXT_BUTTON.pressedSink : 0),
      };
}
export interface ButtonLabelPlacement {
  readonly label: Point;
  readonly mark?: Point;
}
export function buttonLabelPlacement(
  font: BitmapFont,
  scale: number,
  mark: LabelMark | undefined,
  face: Rect,
  text: string,
): ButtonLabelPlacement {
  const ink = textInkBounds(font, scale, font.lineHeight * scale, text);
  const { labelX, markX } = centredLabel(face, ink.width, mark);
  return {
    label: { x: labelX - ink.x, y: face.y + (face.height - ink.height) / 2 - ink.y },
    ...(mark &&
      markX !== undefined && {
        mark: { x: markX, y: face.y + Math.floor((face.height - mark.height) / 2) },
      }),
  };
}
