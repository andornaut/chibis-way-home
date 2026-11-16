import { HUD_EDGE } from "../../data/layout.ts";
import type { Point, Rect } from "../../data/types/index.ts";
import { PAUSE_DISC } from "./controlChrome.ts";
import { topBarButton } from "./topBar.ts";

// Art's pause button in the game's top-left corner: where its frame is drawn, and the area a
// press must land in, its frame grown by hitAreas.ts's rule. The disc is centred in the top
// section, with its left edge HUD_EDGE in from the view's left.
const button = topBarButton(0, {
  height: PAUSE_DISC.frame,
  width: PAUSE_DISC.frame,
  x: HUD_EDGE - PAUSE_DISC.inset,
  y: HUD_EDGE - PAUSE_DISC.inset,
} satisfies Rect);

export const PAUSE_BUTTON = {
  ...button,
  at: { x: button.art.x, y: button.art.y } satisfies Point,
} as const;
