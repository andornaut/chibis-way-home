import type { RenderFit } from "@andornaut/game-kit/view/renderScale";

import { SCREEN } from "../../data/screen";
import { STAGE_PROGRESS } from "../../data/stageProgress";
import type { Rect } from "../../data/types";
import { canvasSize, viewShift } from "./playView";

// The stage progress strip, in base pixels: as wide as the view and under it across, along the
// canvas's bottom.
export function stageProgressRect(fit: RenderFit): Rect {
  const height = 2 * STAGE_PROGRESS.border + STAGE_PROGRESS.colours.fill.length;
  return {
    height,
    width: SCREEN.width,
    x: viewShift(fit).x,
    y: canvasSize(fit).height - height,
  };
}
