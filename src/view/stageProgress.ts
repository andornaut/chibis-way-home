import type { ProgressBarStyle } from "@andornaut/game-kit/progress";

import palette from "../../public/art/palette.json";
import { STAGE_PROGRESS } from "../data/stageProgress";

const colour = (name: keyof typeof palette.colours) =>
  Number.parseInt(palette.colours[name].slice(1), 16);

export const STAGE_PROGRESS_STYLE: ProgressBarStyle = {
  border: STAGE_PROGRESS.border,
  fills: STAGE_PROGRESS.colours.fill.map(colour),
  frame: colour(STAGE_PROGRESS.colours.frame),
  track: colour(STAGE_PROGRESS.colours.track),
};
