import { HUD_EDGE } from "../../data/layout.ts";
import type { Point, Rect } from "../../data/types/index.ts";
import { PAUSE_DISC } from "./controlChrome.ts";
import { hitAround } from "./hitAreas.ts";

// Art's pause button in the game's top-left corner: where its frame is drawn, and the area a
// press must land in, its frame grown by hitAreas.ts's rule. Art draws the disc
// PAUSE_DISC.inset inside its frame, so the disc's edge sits HUD_EDGE in from the view's top
// and left.
const PAUSE_ART: Rect = {
  height: PAUSE_DISC.frame,
  width: PAUSE_DISC.frame,
  x: HUD_EDGE - PAUSE_DISC.inset,
  y: HUD_EDGE - PAUSE_DISC.inset,
};

export const PAUSE_BUTTON = {
  art: PAUSE_ART,
  at: { x: PAUSE_ART.x, y: PAUSE_ART.y } satisfies Point,
  hit: hitAround(PAUSE_ART),
} as const;
