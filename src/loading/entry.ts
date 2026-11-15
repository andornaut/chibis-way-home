// Bootstrap dependencies must load before the failure presenter can exist.
// Once loaded, crash handlers precede the deferred Phaser/game import.
import "../crash/install.ts";
import "@andornaut/game-kit/runtime/web/progress/dom/progressBar.css";
import "@andornaut/game-kit/runtime/web/view/frameTurnLandscapeGame.css";
import "../main.css";
import "./required.css";

import { createLoadingAttempts } from "@andornaut/game-kit/runtime/load/loadingAttempts";

import { beginStartupChecks, mountLoading, startupLoading } from "./progress.ts";
import { mountRequiredLoading, observeRequiredAttempt, requiredLoading } from "./required.ts";

const parent = document.getElementById("game");
if (parent && !new URLSearchParams(window.location.search).has("stagePreview")) {
  mountLoading(parent);
} else {
  document.getElementById("game-loading")?.remove();
  startupLoading.finish();
}

let operation = startupLoading;
let completeNavigation: (() => void) | undefined;

// Phaser and its module graph download only after the existing single top bar is mounted.
const attempts = createLoadingAttempts({
  async load(attempt) {
    const game = await import("../main.ts");
    if (attempt.isCurrent()) {
      await game.bootstrap(attempt);
    }
  },
  onState(state) {
    if (state.kind === "failed") {
      operation.finish();
    }
    requiredLoading.invalidate();
  },
});
const stopAttempt = observeRequiredAttempt(() => {
  operation = beginStartupChecks();
  const navigation = new Promise<void>((resolve) => {
    completeNavigation = resolve;
  });
  try {
    window.location.reload();
  } catch (error) {
    operation.finish();
    completeNavigation?.();
    completeNavigation = undefined;
    throw error;
  }
  // Fresh-document startup owns completion; this page must not report entry as ready.
  return navigation;
}, attempts);
let stopFailure = () => {};
if (parent !== null) {
  const failure = document.createElement("div");
  failure.className = "required-loading-host";
  parent.append(failure);
  stopFailure = mountRequiredLoading(failure);
}
const pageHide = (event: PageTransitionEvent) => {
  if (event.persisted) {
    return;
  }
  attempts.dispose();
  operation.finish();
  stopAttempt();
  stopFailure();
  requiredLoading.dispose();
  completeNavigation?.();
  completeNavigation = undefined;
  window.removeEventListener("pagehide", pageHide);
};
window.addEventListener("pagehide", pageHide);
void attempts.start();
