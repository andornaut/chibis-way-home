// Bootstrap dependencies must load before the failure presenter can exist.
// Once loaded, crash handlers precede the deferred Phaser/game import.
import "./crash/index.ts";
import "@andornaut/game-kit/runtime/web/progress/dom/progressBar.css";
import "@andornaut/game-kit/runtime/web/view/frameTurnLandscapeGame.css";
import "./main.css";
import "./loading/required.css";

import { createLoadingAttempts } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { LaunchResult } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import { trackInputModality } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { lockGameOrientation } from "@andornaut/game-kit/runtime/web/view/dom/watchFrameTurn";

import {
  beginStartupChecks,
  loadingFailurePresentation,
  mountLoading,
  mountRequiredLoading,
  observeRequiredAttempt,
  requiredLoading,
  startupLoading,
} from "./loading/index.ts";
import { installOffer, setupPhoneApp } from "./pwa/index.ts";

const parent = document.getElementById("game");
if (parent && !new URLSearchParams(window.location.search).has("stagePreview")) {
  mountLoading(parent);
} else {
  document.getElementById("game-loading")?.remove();
  startupLoading.finish();
}

let operation = startupLoading;
let completeNavigation: (() => void) | undefined;
let launch: Promise<LaunchResult> | undefined;
const failureHost = document.createElement("div");
failureHost.className = "required-loading-host";
let disposeUnsupported: (() => void) | undefined;

// Install or select the routed build before importing Phaser. The shell owns the single
// document launch and its progress while the game is still absent.
const attempts = createLoadingAttempts({
  async load(attempt) {
    if (launch === undefined) {
      const prepared = setupPhoneApp(
        {
          failure: { presentation: loadingFailurePresentation(1) },
          onUnsupported: () => operation.finish(),
          parent: failureHost,
        },
        () => {
          trackInputModality(document);
          installOffer();
          lockGameOrientation("landscape", screen);
        },
      );
      if ("kind" in prepared) {
        disposeUnsupported = () => prepared.failure.dispose();
        return;
      }
      launch = prepared;
    }
    if ((await launch) === "reloading" || !attempt.isCurrent()) {
      return;
    }
    const game = await import("./main.ts");
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
  parent.append(failureHost);
  stopFailure = mountRequiredLoading(failureHost);
}
const pageHide = (event: PageTransitionEvent) => {
  if (event.persisted) {
    return;
  }
  attempts.dispose();
  operation.finish();
  stopAttempt();
  stopFailure();
  disposeUnsupported?.();
  requiredLoading.dispose();
  completeNavigation?.();
  completeNavigation = undefined;
  window.removeEventListener("pagehide", pageHide);
};
window.addEventListener("pagehide", pageHide);
void attempts.start();
