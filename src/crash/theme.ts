import type { CrashColours } from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";

import palette from "../../public/art/palette.json" with { type: "json" };
import { BIRD_FRAME, CRASH_BIRD_URL } from "../assets/birdFrame.ts";

const { amber, dslate, ink, lgrey, navy, white, yellow } = palette.colours;

export const CRASH_COLOURS: CrashColours = {
  background: navy,
  buttonFace: dslate,
  buttonLip: navy,
  ink,
  text: white,
};

// The HTML fallback uses the same held pose as the game, without needing its renderer.
export function installCrashTheme(style: Pick<CSSStyleDeclaration, "setProperty">): void {
  const scale = 2;
  for (const [name, value] of Object.entries({
    "bird-height": `${BIRD_FRAME.height * scale}px`,
    "bird-image": `url("${CRASH_BIRD_URL}")`,
    "bird-width": `${BIRD_FRAME.width * scale}px`,
    "card-face": lgrey,
    "focus-face": yellow,
    "press-face": amber,
  })) {
    style.setProperty(`--chibi-crash-${name}`, value);
  }
}
