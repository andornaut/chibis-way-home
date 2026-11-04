import type { TouchChromeColours, TouchChromeLayer } from "./touchChrome";

export const PAUSE_CHROME_FRAME = 35;
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
  const outer = expanded ? 17.5 : 16.5;
  const core = pose === "rest" ? colours.cream : colours.white;
  const face = pose === "rest" ? colours.navy : colours.dslate;
  const radius = pose === "rest" || expanded ? 13.5 : 12.5;
  return [
    { centre, colour: colours.ink, kind: "disc", radius: outer },
    { centre, colour: core, kind: "disc", radius: outer - 1 },
    { centre, colour: face, kind: "disc", radius },
    { colour: core, kind: "rect", rect: { height: 13, width: 4, x: 12, y: 11 } },
    { colour: core, kind: "rect", rect: { height: 13, width: 4, x: 19, y: 11 } },
  ];
}
