import {
  PAUSE_CHROME_FRAME,
  type PauseChromeColours,
  pauseChromeLayers,
  type PauseChromePose,
  pauseRingLayer,
} from "../chrome/pauseChrome.ts";
import { createPaletteSvg } from "./chrome.ts";

// Who draws a navigation disc's ink ring: its own art, as Exit's icon does, or the kit's HUD disc
// the art sits in, as the entry's does (pause.css).
export type NavigationRing = "art" | "kit";

// A navigation disc's art in its frame. Each circle names its part (data-part: ring, rim or face)
// for pause.css; the glyph is the rects and the path.
export function createNavigationDisc(
  document: Document,
  colours: PauseChromeColours,
  ring: NavigationRing,
  pose: PauseChromePose,
  mode: "exit" | "menu" | "pause",
): SVGSVGElement {
  const parts = ring === "art" ? ["ring", "rim", "face"] : ["rim", "face"];
  const layers = pauseChromeLayers(colours, pose, mode);
  const disc = createPaletteSvg(
    document,
    colours,
    { height: PAUSE_CHROME_FRAME, width: PAUSE_CHROME_FRAME },
    ring === "art" ? [pauseRingLayer(colours), ...layers] : layers,
  );
  disc.classList.add("navigation-disc");
  parts.forEach((part, index) => disc.children[index]!.setAttribute("data-part", part));
  if (mode === "exit") {
    const door = document.createElementNS(disc.namespaceURI, "path");
    door.setAttribute("d", "M3 2H12V7H10V4H5V16H10V13H12V18H3ZM7 9H14V6L18.5 10L14 14V11H7Z");
    door.setAttribute("transform", "translate(8.6 7.5)");
    disc.append(door);
  }
  return disc;
}
