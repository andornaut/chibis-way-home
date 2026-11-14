import { PAUSE_GLYPH } from "../../data/layout.ts";
import { PAUSE_DISC } from "../layout/controlChrome.ts";
import type { TouchChromeColours, TouchChromeLayer } from "./touchChrome.ts";

export const PAUSE_CHROME_FRAME = PAUSE_DISC.frame;
export type PauseChromePose = "held" | "press" | "rest";
interface PauseChromeColours extends TouchChromeColours {
  readonly dslate: number;
  readonly navy: number;
}

export function pauseChromeLayers(
  colours: PauseChromeColours,
  pose: PauseChromePose,
  expanded: boolean,
): readonly TouchChromeLayer[] {
  const centre = { x: PAUSE_CHROME_FRAME / 2, y: PAUSE_CHROME_FRAME / 2 };
  const outer = expanded ? PAUSE_DISC.expandedRadius : PAUSE_DISC.restRadius;
  const core = pose === "rest" ? colours.cream : colours.white;
  const face = pose === "rest" ? colours.navy : colours.dslate;
  const radius = pose === "rest" || expanded ? 13.5 : 12.5;
  return [
    { centre, colour: colours.ink, kind: "disc", radius: outer },
    { centre, colour: core, kind: "disc", radius: outer - 1 },
    { centre, colour: face, kind: "disc", radius },
    ...PAUSE_GLYPH.bars.map((rect) => ({ colour: core, kind: "rect" as const, rect })),
  ];
}
