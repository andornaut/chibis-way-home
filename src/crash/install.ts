// Installs the kit's crash screen. src/main.ts imports this first, so an error thrown while any
// other module loads shows the screen rather than a blank page.
import "@andornaut/game-kit/crash/crash.css";
import "./theme.css";

import { BUILD_LABEL } from "@andornaut/game-kit/build/buildLabel";
import { installCrashScreen } from "@andornaut/game-kit/crash/crashScreen";

import { TEXT } from "../data/text";
import { CRASH_COLOURS, installCrashTheme } from "./theme";

installCrashTheme(document.documentElement.style);

// ?dev=1 shows the error's message and stack, with a Copy button.
export const CRASH_SCREEN = installCrashScreen({
  buildLabel: BUILD_LABEL,
  colours: CRASH_COLOURS,
  dev: new URLSearchParams(window.location.search).get("dev") === "1",
  words: TEXT.crash,
});
