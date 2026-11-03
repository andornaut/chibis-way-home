import { SCREEN } from "../data/screen";
import { STAGE_PROGRESS } from "../data/stageProgress";
import type { Rect, Size } from "../data/types";
import { bottomShift } from "./playView";

export function stageProgressRect(canvasSize: Size): Rect {
  const height = 2 * STAGE_PROGRESS.border + STAGE_PROGRESS.colours.fill.length;
  const shift = bottomShift(canvasSize);
  return {
    height,
    width: SCREEN.width,
    x: shift.x,
    y: SCREEN.height + shift.y - height,
  };
}
