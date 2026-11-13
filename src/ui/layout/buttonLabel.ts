import { TEXT_BUTTON } from "../../data/layout.ts";
import type { Rect } from "../../data/types/index.ts";

// A mark drawn just before a button's label, such as Resume's play triangle: its width, and the
// gap from it to the label's ink.
interface LabelMark {
  readonly gap: number;
  readonly height: number;
  readonly width: number;
}

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
