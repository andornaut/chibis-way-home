import { MENU_GLYPH, PAUSE_GLYPH } from "../../data/layout.ts";
import { PAUSE_DISC } from "../layout/index.ts";
import type { TouchChromeColours, TouchChromeLayer } from "./touchChrome.ts";

export const PAUSE_CHROME_FRAME = PAUSE_DISC.frame;
export type PauseChromePose = "held" | "press" | "rest";
export interface PauseChromeColours extends TouchChromeColours {
  readonly dslate: number;
  readonly navy: number;
}

// Only the glyph is art. The shared HUD disc draws the rim, ring and face.
export function pauseChromeLayers(
  colours: PauseChromeColours,
  pose: PauseChromePose,
  mode: "exit" | "menu" | "pause" = "pause",
): readonly TouchChromeLayer[] {
  const core = pose === "rest" ? colours.cream : colours.white;
  const bars = mode === "exit" ? [] : (mode === "menu" ? MENU_GLYPH : PAUSE_GLYPH).bars;
  return bars.map((rect) => ({ colour: core, kind: "rect", rect }));
}
