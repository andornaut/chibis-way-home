import {
  createProgressState,
  type ProgressHandle,
  type ProgressSnapshot,
} from "@andornaut/game-kit/progressState";
import { createDomProgressBar } from "@andornaut/game-kit/web/progress/dom/progressBar";

import { SCREEN } from "../data/screen";
import { LOADING_TIMING, PROGRESS_RECT, stageProgressStyle } from "./style";

export const loadingProgress = createProgressState();
export const installProgress = createProgressState();
export const startupLoading = loadingProgress.begin();
let refreshStyle: (stage: string) => void = () => undefined;

// The startup load's second phase. The file load is measured, so it finishes full; the startup
// checks after it are unknown work, a pending phase of their own, which the bar shows once its
// full hold and fade have ended.
export function beginStartupChecks(): ProgressHandle {
  startupLoading.progress(1);
  startupLoading.finish();
  return loadingProgress.begin();
}

export function beginStageLoading(stage: string): ProgressHandle {
  refreshStyle(stage);
  return loadingProgress.begin();
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
  let foreground: ProgressSnapshot = { active: false, value: undefined };
  let background = foreground;
  let holding: (() => void) | undefined;
  // A stage's restyle that arrived during a hold or fade, applied once the fade has ended.
  let restyle: string | undefined;
  const recreate = (stage: string) => {
    bar.remove();
    bar = createDomProgressBar(host, stageProgressStyle(stage), PROGRESS_RECT, LOADING_TIMING);
  };
  // The bar follows the foreground load, or the background install while none runs: a measured
  // finish fills to full, holds, fades and then hides, and an unknown one hides at once. While a
  // full bar holds or fades, nothing else shows; the state then current follows once it has faded.
  const show = () => {
    if (holding !== undefined) {
      return;
    }
    const before = bar.element.dataset.state;
    // A measured load that just finished fills to full even while the install runs behind it.
    const finished = !foreground.active && before === "determinate";
    bar.report(foreground.active || finished ? foreground : background);
    if (before !== "complete" && bar.element.dataset.state === "complete") {
      holding = afterFade(() => {
        holding = undefined;
        if (restyle !== undefined) {
          recreate(restyle);
          restyle = undefined;
        }
        show();
      });
    }
    const name = parent.getAttribute("aria-label");
    if (name) {
      bar.element.setAttribute("aria-label", name);
    }
  };
  refreshStyle = (stage) => {
    if (holding !== undefined) {
      restyle = stage;
      return;
    }
    recreate(stage);
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
  const offForeground = loadingProgress.subscribe((state) => {
    foreground = state;
    show();
  });
  const offBackground = installProgress.subscribe((state) => {
    background = state;
    show();
  });
  return () => {
    holding?.();
    observer.disconnect();
    offForeground();
    offBackground();
    bar.remove();
    host.remove();
    refreshStyle = () => undefined;
  };
}

// A complete bar's CSS hold and fade start with the first frame after it turned complete, which
// can come well after the report while startup work holds the main thread; the hold ends with
// them. Returns a cancel.
function afterFade(done: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    timer = setTimeout(done, LOADING_TIMING.fullMs + LOADING_TIMING.fadeMs);
  });
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
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
