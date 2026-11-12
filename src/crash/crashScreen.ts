// The page's crash screen (the kit's web/crash/dom/crashScreen), in the game's words and palette,
// with the message, stack and build label under dev=1. It writes nothing to the save, whose
// in-memory state may be corrupt. src/crash/install.ts imports this module before any other.
import "@andornaut/game-kit/web/crash/dom/crash.css";
import "./theme.css";

import { installCrashScreen } from "@andornaut/game-kit/web/crash/dom/crashScreen";

import { BUILD_LABEL } from "../buildLabel.ts";
import { CRASH_TEXT } from "../data/crashText.ts";
import { CRASH_COLOURS, installCrashTheme } from "./theme.ts";

installCrashTheme(document.documentElement.style);

// ?dev=1 shows the error's message and stack, with a Copy button.
export const CRASH_SCREEN = installCrashScreen(window, {
  buildLabel: BUILD_LABEL,
  colours: CRASH_COLOURS,
  dev: new URLSearchParams(window.location.search).get("dev") === "1",
  words: CRASH_TEXT,
});
