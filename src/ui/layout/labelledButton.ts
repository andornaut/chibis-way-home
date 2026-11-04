import type { Rect } from "../../data/types";
import { hitAround } from "./hitAreas";

export interface LabelledButton {
  readonly button: Rect;
  readonly hit: Rect;
}

export function labelledButton(button: Rect): LabelledButton {
  return {
    button,
    hit: hitAround(button),
  };
}
