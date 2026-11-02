import "../platform/view/frameTurnLandscapeGame.css";
import "../main.css";

import { mountLoading, startupLoading } from "./progress";

const parent = document.getElementById("game");
if (parent && !new URLSearchParams(window.location.search).has("stagePreview")) {
  mountLoading(parent);
} else {
  document.getElementById("game-loading")?.remove();
  startupLoading.finish();
}

// Phaser and the game scenes download after the lightweight progress adapter has mounted.
void import("../main");
