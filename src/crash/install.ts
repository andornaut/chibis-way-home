// Installs the kit's crash screen. src/main.ts imports this first, so an error thrown while any
// other module loads shows the screen rather than a blank page.
import "@andornaut/game-kit/web/crash/dom/crash.css";
import "./theme.css";

import { buildLabel } from "@andornaut/game-kit/web/build/buildLabel";
import { installCrashScreen } from "@andornaut/game-kit/web/crash/dom/crashScreen";

import { TEXT } from "../data/text";
import { CRASH_COLOURS, installCrashTheme } from "./theme";

installCrashTheme(document.documentElement.style);

// ?dev=1 shows the error's message and stack, with a Copy button.
export const CRASH_SCREEN = installCrashScreen(window, {
  buildLabel: buildLabel(__APP_VERSION__, __COMMIT__),
  colours: CRASH_COLOURS,
  dev: new URLSearchParams(window.location.search).get("dev") === "1",
  words: TEXT.crash,
});
