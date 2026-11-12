import type { GameText } from "./types/index.ts";

// The crash screen's words, kept apart from TEXT so the first-paint chunk that installs the
// crash screen does not load every player string.
export const CRASH_TEXT: GameText["crash"] = {
  body: "The game stopped. Reload to play again.",
  reload: "Reload",
  title: "Something went wrong",
};
