import { MENU_GLYPH, PAUSE_GLYPH } from "../../data/layout.ts";
import { PAUSE_DISC } from "../layout/controlChrome.ts";
import type { TouchChromeColours, TouchChromeLayer } from "./touchChrome.ts";

export const PAUSE_CHROME_FRAME = PAUSE_DISC.frame;
export type PauseChromePose = "held" | "press" | "rest";
export interface PauseChromeColours extends TouchChromeColours {
  readonly dslate: number;
  readonly navy: number;
}

export function pauseChromeLayers(
  colours: PauseChromeColours,
  pose: PauseChromePose,
  mode: "exit" | "menu" | "pause" = "pause",
): readonly TouchChromeLayer[] {
  const centre = { x: PAUSE_CHROME_FRAME / 2, y: PAUSE_CHROME_FRAME / 2 };
  const outer = PAUSE_DISC.restRadius;
  const core = pose === "rest" ? colours.cream : colours.white;
  const face = pose === "rest" ? colours.navy : colours.dslate;
  const radius = outer - 3;
  const bars = mode === "exit" ? [] : (mode === "menu" ? MENU_GLYPH : PAUSE_GLYPH).bars;
  return [
    { centre, colour: colours.ink, kind: "disc", radius: outer },
    { centre, colour: colours.cream, kind: "disc", radius: outer - 1 },
    { centre, colour: face, kind: "disc", radius },
    ...bars.map((rect) => ({
      colour: core,
      kind: "rect" as const,
      rect,
    })),
  ];
}
