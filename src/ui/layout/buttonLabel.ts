import { TEXT_BUTTON } from "../../data/layout.ts";
import type { Rect } from "../../data/types/index.ts";

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
