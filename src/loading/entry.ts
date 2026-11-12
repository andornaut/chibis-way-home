// Installs the crash screen before the loading strip, Phaser or any game module runs.
import "../crash/install.ts";
import "@andornaut/game-kit/web/progress/dom/progressBar.css";
import "@andornaut/game-kit/web/view/frameTurnLandscapeGame.css";
import "../main.css";

import { mountLoading, startupLoading } from "./progress.ts";

const parent = document.getElementById("game");
if (parent && !new URLSearchParams(window.location.search).has("stagePreview")) {
  mountLoading(parent);
} else {
  document.getElementById("game-loading")?.remove();
  startupLoading.finish();
}

// Phaser and the game scenes download after the lightweight progress adapter has mounted.
void import("../main.ts");
