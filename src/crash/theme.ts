import type { CrashColours } from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";
import { setTextRoles, setUiColours } from "@andornaut/game-kit/runtime/web/ui/dom/uiTheme";

import palette from "../../public/art/palette.json" with { type: "json" };
import { BIRD_FRAME, CRASH_BIRD_URL } from "../assets/index.ts";
import { PAGE_THEME_COLOURS, THEME_TEXT } from "../data/layout.ts";

const { dslate, ink, navy, white } = palette.colours;

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
  })) {
    style.setProperty(`--chibi-crash-${name}`, value);
  }
}

// Sets the kit theme's text roles and colour slots (PAGE_THEME_COLOURS) on the page's root, which
// the crash screen and the startup failure and capability cards read outside the interface.
export function installPageTheme(root: HTMLElement): void {
  const colours: Readonly<Record<string, string>> = palette.colours;
  setTextRoles(THEME_TEXT, root);
  setUiColours(
    Object.fromEntries(
      Object.entries(PAGE_THEME_COLOURS).map(([role, name]) => {
        const colour = colours[name];
        if (colour === undefined) {
          throw new Error(`The palette has no ${name}`);
        }
        return [role, colour];
      }),
    ),
    root,
  );
}
