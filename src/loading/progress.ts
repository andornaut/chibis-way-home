import {
  createLayeredProgress,
  createProgressState,
  type ProgressHandle,
  type ProgressSnapshot,
} from "@andornaut/game-kit/progressState";
import { createDomProgressBar } from "@andornaut/game-kit/web/progress/dom/progressBar";

import { SCREEN } from "../data/screen.ts";
import { LOADING_TIMING, PROGRESS_RECT, stageProgressStyle } from "./style.ts";

// The bar shows only loads the player waits for, each through its own entry point: boot (the
// pre-script startupLoading, then BootScene's file load, which its loader watch measures as
// waited, then beginStartupChecks) and entering a zone (beginStageLoading) in the foreground; the
// first visit's precache (beginPrecache) and a forced update (beginRequiredUpdate) in the
// background, which shows while no foreground load runs (the kit's createLayeredProgress).
// Loads in the background during play, such as an update's install or a loader retry round,
// have no entry point and never show it.
export const loadingProgress = createProgressState();
export const backgroundProgress = createProgressState();
// The page's own load before Phaser's loader runs: unknown work, which the boot's waited file
// load replaces as it starts.
export const startupLoading = loadingProgress.begin();
let refreshStyle: (stage: string) => void = () => undefined;

// The startup load's second phase, after the measured file load: the startup checks (reading the
// save and preparing the HTML UI, never offline play) are unknown work of their own, which cut
// the file load's full hold short.
export function beginStartupChecks(): ProgressHandle {
  return loadingProgress.begin();
}

export function beginStageLoading(stage: string): ProgressHandle {
  refreshStyle(stage);
  return loadingProgress.begin();
}

// A forced update for a save a newer version wrote: unknown work in the background, shown once
// the boot's startup checks have ended.
export function beginRequiredUpdate(): ProgressHandle {
  return backgroundProgress.begin();
}

// The first visit's precache: unknown work in the background.
export function beginPrecache(): ProgressHandle {
  return backgroundProgress.begin();
}

export function mountLoading(parent: HTMLElement): () => void {
  const document = parent.ownerDocument;
  const host = document.getElementById("game-loading") ?? document.createElement("div");
  host.id = "game-loading";
  host.replaceChildren();
  if (!host.parentNode) {
    parent.append(host);
  }
  let bar = createDomProgressBar(host, stageProgressStyle(), PROGRESS_RECT, LOADING_TIMING);
  // The foreground over the background, each finished measured load held full and faded before
  // the other shows, unless a foreground load begins meanwhile.
  const layered = createLayeredProgress(window, LOADING_TIMING, {
    background: backgroundProgress,
    foreground: loadingProgress,
  });
  let current: ProgressSnapshot = { active: false, value: undefined };
  const show = () => {
    bar.report(current);
    const name = parent.getAttribute("aria-label");
    if (name) {
      bar.element.setAttribute("aria-label", name);
    }
  };
  // A stage's themed bar, reported the current snapshot at once.
  refreshStyle = (stage) => {
    bar.remove();
    bar = createDomProgressBar(host, stageProgressStyle(stage), PROGRESS_RECT, LOADING_TIMING);
    show();
  };
  const resize = () =>
    host.style.setProperty(
      "--loading-scale",
      String(Math.min(parent.offsetWidth / SCREEN.width, parent.offsetHeight / SCREEN.height)),
    );
  const observer = new ResizeObserver(resize);
  observer.observe(parent);
  resize();
  const off = layered.subscribe((snapshot) => {
    current = snapshot;
    show();
  });
  return () => {
    off();
    layered.dispose();
    observer.disconnect();
    bar.remove();
    host.remove();
    refreshStyle = () => undefined;
  };
}

// Two animation-frame callbacks allow the pending strip to paint before synchronous preparation.
export function afterLoadingPaint(
  work: () => void,
  schedule: (callback: FrameRequestCallback) => number = requestAnimationFrame,
): () => void {
  let cancelled = false;
  schedule(() =>
    schedule(() => {
      if (!cancelled) {
        work();
      }
    }),
  );
  return () => {
    cancelled = true;
  };
}
