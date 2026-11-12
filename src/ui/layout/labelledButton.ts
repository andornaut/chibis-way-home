import type { Rect } from "../../data/types/index.ts";
import { hitAround } from "./hitAreas.ts";

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
