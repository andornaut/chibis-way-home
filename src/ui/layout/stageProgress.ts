import { SCREEN } from "../../data/screen";
import { STAGE_PROGRESS } from "../../data/stageProgress";
import type { Rect, Size } from "../../data/types";
import { playView } from "./playView";

// The stage progress strip: as wide as the view and under it across, along the canvas's bottom.
export function stageProgressRect(canvasSize: Size): Rect {
  const height = 2 * STAGE_PROGRESS.border + STAGE_PROGRESS.colours.fill.length;
  return {
    height,
    width: SCREEN.width,
    x: playView(canvasSize).x,
    y: Math.floor(canvasSize.height) - height,
  };
}
