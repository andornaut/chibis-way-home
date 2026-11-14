import { CONTROL_DISC_FRAME, CONTROL_FRAME_INSET } from "../../data/layout.ts";

const frame = CONTROL_DISC_FRAME;
const restDiameter = frame - 2 * CONTROL_FRAME_INSET;

export const PAUSE_DISC = {
  expandedRadius: frame / 2,
  frame,
  inset: CONTROL_FRAME_INSET,
  restDiameter,
  restRadius: restDiameter / 2,
} as const;

// Visible diameter of the native Pause rest disc, excluding its transparent frame inset.
export const PAUSE_VISIBLE_DIAMETER = PAUSE_DISC.restDiameter;
