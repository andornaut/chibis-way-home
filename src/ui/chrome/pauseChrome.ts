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
  const radius = PAUSE_DISC.restRadius - (pose === "rest" || expanded ? 3 : 4);
  return [
    { centre, colour: colours.ink, kind: "disc", radius: outer },
    { centre, colour: core, kind: "disc", radius: outer - PAUSE_DISC.inset },
    { centre, colour: face, kind: "disc", radius },
    { colour: core, kind: "rect", rect: { height: 13, width: 4, x: 12, y: 11 } },
    { colour: core, kind: "rect", rect: { height: 13, width: 4, x: 19, y: 11 } },
  ];
}
