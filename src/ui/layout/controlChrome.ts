import type { HudDiscSize } from "@andornaut/game-kit/runtime/ui/hudDisc";

import { CONTROL_DISC_FRAME, CONTROL_FRAME_INSET, SKILL_HUD } from "../../data/layout.ts";

const frame = CONTROL_DISC_FRAME;
const restDiameter = frame - 2 * CONTROL_FRAME_INSET;

// The entry and Exit discs: a frame-sized box, the drawn disc inset inside it, and the disc's ink
// ring, ring units wide at its edge.
export const PAUSE_DISC = {
  expandedRadius: frame / 2,
  frame,
  inset: CONTROL_FRAME_INSET,
  restDiameter,
  restRadius: restDiameter / 2,
  ring: 1,
} as const;

// Visible diameter of the native Pause rest disc, excluding its transparent frame inset.
export const PAUSE_VISIBLE_DIAMETER = PAUSE_DISC.restDiameter;

// The HUD discs' size tokens (the kit's hudDisc), in base px. The entry's face is art's frame,
// which its pose art fills; a skill's face is its drawn disc, with the glyph's frame its icon.
export const HUD_DISC_SIZES = {
  entry: { face: frame, icon: frame },
  skill: { face: restDiameter, icon: SKILL_HUD.glyph },
} as const satisfies Record<string, HudDiscSize>;
