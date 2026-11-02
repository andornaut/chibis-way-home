// Installs the kit's crash screen. src/main.ts imports this first, so an error thrown while any
// other module loads shows the screen rather than a blank page.
import "../platform/crash/crash.css";
import "./theme.css";

import { TEXT } from "../data/text";
import { BUILD_LABEL } from "../platform/build/buildLabel";
import { installCrashScreen } from "../platform/crash/crashScreen";
import { CRASH_COLOURS, installCrashTheme } from "./theme";

installCrashTheme(document.documentElement.style);

// ?dev=1 shows the error's message and stack, with a Copy button.
export const CRASH_SCREEN = installCrashScreen({
  buildLabel: BUILD_LABEL,
  colours: CRASH_COLOURS,
  dev: new URLSearchParams(window.location.search).get("dev") === "1",
  words: TEXT.crash,
});
