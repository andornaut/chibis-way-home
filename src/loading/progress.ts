import type { ProgressBarStyle } from "@andornaut/game-kit/runtime/progress";
import {
  createLayeredProgress,
  createProgressState,
  type ProgressHandle,
  type ProgressSnapshot,
} from "@andornaut/game-kit/runtime/progressState";
import { createDomProgressBar } from "@andornaut/game-kit/runtime/web/progress/dom/progressBar";

import { loadingUnit } from "./presentation.ts";
import { LOADING_TIMING, modalProgressStyle, PROGRESS_RECT, stageProgressStyle } from "./style.ts";

// The game element's attribute that marks a modal window open (src/scenes/modalInput.ts).
const MODAL_OPEN = "data-modal-open";
const cssColour = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// Writes style's colours onto a mounted kit bar in place, so its state, full hold and travel carry
// on: the frame on the bar, the track on its first child and each fill on its band's segment.
function paintBar(element: HTMLElement, style: ProgressBarStyle): void {
  const fill = (box: Element | null | undefined, colour: number | undefined) => {
    if (box instanceof HTMLElement && colour !== undefined) {
      box.style.backgroundColor = cssColour(colour);
    }
  };
  const [track, ...bands] = element.children;
  fill(element, style.frame);
  fill(track, style.track);
  bands.forEach((band, index) => fill(band.firstElementChild, style.fills[index]));
}

// The bar shows only loads the player waits for, each through its own entry point: boot (the
// pre-script startupLoading, which a first install's progress drives, then BootScene's file load,
// which its loader watch measures as waited, then beginStartupChecks; launch.ts joins the first
// two into one value) and entering a zone (beginStageLoading) in the foreground; a forced update
// (beginRequiredUpdate) in the background, which shows while no foreground load runs (the kit's
// createLayeredProgress). Loads in the background during play, such as an update's staging or a
// loader retry round, have no entry point and never show it.
export const loadingProgress = createProgressState();
export const backgroundProgress = createProgressState();
// The page's own load before Phaser's loader runs: unknown work, measured while a first install
// runs, which the boot's waited file load replaces as it starts.
export const startupLoading = loadingProgress.begin();
let refreshStyle: (stage: string) => void = () => undefined;

// The startup load's second phase, after the measured file load: the startup checks (reading the
// save and preparing the HTML UI, never an install) are unknown work of their own, which cut
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

export function mountLoading(parent: HTMLElement): () => void {
  const document = parent.ownerDocument;
  const host = document.getElementById("game-loading") ?? document.createElement("div");
  host.id = "game-loading";
  host.replaceChildren();
  if (!host.parentNode) {
    parent.append(host);
  }
  let style = stageProgressStyle();
  let bar = createDomProgressBar(host, style, PROGRESS_RECT, LOADING_TIMING);
  // Under a modal window the bar stays painted over the canvas, inert, in the modal dim's colours.
  let dimmed = false;
  const paint = () => paintBar(bar.element, dimmed ? modalProgressStyle(style) : style);
  const followModal = () => {
    if (dimmed !== parent.hasAttribute(MODAL_OPEN)) {
      dimmed = !dimmed;
      paint();
    }
  };
  const modal = new MutationObserver(followModal);
  modal.observe(parent, { attributeFilter: [MODAL_OPEN], attributes: true });
  followModal();
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
    style = stageProgressStyle(stage);
    bar = createDomProgressBar(host, style, PROGRESS_RECT, LOADING_TIMING);
    paint();
    show();
  };
  const resize = () => host.style.setProperty("--loading-scale", String(loadingUnit(parent)));
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
    modal.disconnect();
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
