import {
  PAUSE_CHROME_FRAME,
  type PauseChromeColours,
  pauseChromeLayers,
  type PauseChromePose,
} from "../chrome/pauseChrome.ts";
import { createPaletteSvg } from "./chrome.ts";

export function createNavigationDisc(
  document: Document,
  colours: PauseChromeColours,
  pose: PauseChromePose,
  mode: "exit" | "menu" | "pause",
): SVGSVGElement {
  const disc = createPaletteSvg(
    document,
    colours,
    { height: PAUSE_CHROME_FRAME, width: PAUSE_CHROME_FRAME },
    pauseChromeLayers(colours, pose, mode),
  );
  disc.classList.add("navigation-disc");
  if (mode === "exit") {
    const door = document.createElementNS(disc.namespaceURI, "path");
    door.setAttribute("d", "M3 2H12V7H10V4H5V16H10V13H12V18H3ZM7 9H14V6L18.5 10L14 14V11H7Z");
    door.setAttribute("transform", "translate(8.6 7.5)");
    disc.append(door);
  }
  return disc;
}
