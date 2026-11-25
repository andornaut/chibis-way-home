import { MENU_GLYPH, PAUSE_GLYPH } from "../../data/layout.ts";
import { PAUSE_DISC } from "../layout/controlChrome.ts";
import type { TouchChromeColours, TouchChromeLayer } from "./touchChrome.ts";

export const PAUSE_CHROME_FRAME = PAUSE_DISC.frame;
export type PauseChromePose = "held" | "press" | "rest";
export interface PauseChromeColours extends TouchChromeColours {
  readonly dslate: number;
  readonly navy: number;
}

const centre = { x: PAUSE_CHROME_FRAME / 2, y: PAUSE_CHROME_FRAME / 2 };

// The disc's ink ring at its edge, PAUSE_DISC.inset inside the frame. Exit's art draws it; the
// kit's HUD disc draws the entry's (pause.css).
export function pauseRingLayer(colours: PauseChromeColours): TouchChromeLayer {
  return { centre, colour: colours.ink, kind: "disc", radius: PAUSE_DISC.restRadius };
}

// The disc inside its ring: the cream rim, the pose's face and the mode's glyph.
export function pauseChromeLayers(
  colours: PauseChromeColours,
  pose: PauseChromePose,
  mode: "exit" | "menu" | "pause" = "pause",
): readonly TouchChromeLayer[] {
  const outer = PAUSE_DISC.restRadius;
  const core = pose === "rest" ? colours.cream : colours.white;
  const face = pose === "rest" ? colours.navy : colours.dslate;
  const bars = mode === "exit" ? [] : (mode === "menu" ? MENU_GLYPH : PAUSE_GLYPH).bars;
  return [
    { centre, colour: colours.cream, kind: "disc", radius: outer - PAUSE_DISC.ring },
    { centre, colour: face, kind: "disc", radius: outer - 3 },
    ...bars.map((rect) => ({
      colour: core,
      kind: "rect" as const,
      rect,
    })),
  ];
}
