import {
  createProgressState,
  type ProgressHandle,
  type ProgressSnapshot,
} from "@andornaut/game-kit/progressState";
import { createDomProgressBar } from "@andornaut/game-kit/web/progress/dom/progressBar";

import { SCREEN } from "../data/screen";
import { PROGRESS_RECT, stageProgressStyle } from "./style";

export const loadingProgress = createProgressState();
export const installProgress = createProgressState();
export const startupLoading = loadingProgress.begin();
let refreshStyle: (stage: string) => void = () => undefined;

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
  let bar = createDomProgressBar(host, stageProgressStyle(), PROGRESS_RECT);
  let foreground: ProgressSnapshot = { active: false, value: undefined };
  let background = foreground;
  // The bar follows the foreground load, or the background install while none runs: a measured
  // finish fills to full and then hides, and an unknown one hides at once.
  const show = () => {
    bar.report(foreground.active ? foreground : background);
    const name = parent.getAttribute("aria-label");
    if (name) {
      bar.element.setAttribute("aria-label", name);
    }
  };
  refreshStyle = (stage) => {
    bar.remove();
    bar = createDomProgressBar(host, stageProgressStyle(stage), PROGRESS_RECT);
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
    observer.disconnect();
    offForeground();
    offBackground();
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
