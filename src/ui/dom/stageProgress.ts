import type { ProgressBarStyle } from "@andornaut/game-kit/progress";
import { createDomProgressBar } from "@andornaut/game-kit/web/progress/dom/progressBar";
import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { STAGE_PROGRESS } from "../../data/stageProgress.ts";
import type { Point, Rect, Size } from "../../data/types/index.ts";

export const STAGE_PROGRESS_PROPERTIES = {
  "--stage-progress-canvas-height": 0,
  "--stage-progress-canvas-width": 0,
  "--stage-progress-shift-x": 0,
  "--stage-progress-shift-y": 0,
};

export interface StageProgressView {
  // The kit bar, available after the first placement and replaced only when its rect changes.
  readonly element: HTMLDivElement | undefined;
  // The full-layer scene root; its plane scales the kit's base-pixel geometry.
  readonly root: HTMLElement;
  // The unchanged canvas-base-pixel rect from stageProgressRect, including the bottom bar.
  place(rect: Rect): void;
  // Actual canvas size and play-view shift, in base pixels, supplied by the scene adapter.
  placeCanvas(viewShift: Point, canvas: Size): void;
  setVisible(shown: boolean): void;
  update(value: number): void;
}

function bindPalette(element: HTMLDivElement): void {
  element.style.backgroundColor = `var(--colour-${STAGE_PROGRESS.colours.frame})`;
  const [track, ...bands] = [...element.children] as HTMLElement[];
  track!.style.backgroundColor = `var(--colour-${STAGE_PROGRESS.colours.track})`;
  bands.forEach((band, index) => {
    (band.firstElementChild as HTMLElement).style.backgroundColor =
      `var(--colour-${STAGE_PROGRESS.colours.fill[index]})`;
  });
}

// A determinate strip: updates may move backwards and never start loading, hold or fade timing.
export function createStageProgress(
  document: Document,
  style: ProgressBarStyle,
  label: string,
): StageProgressView {
  const root = document.createElement("div");
  root.className = "stage-progress-scene";
  root.hidden = true;
  writeLayoutProperties(STAGE_PROGRESS_PROPERTIES, root);
  const canvas = document.createElement("div");
  canvas.className = "stage-progress-canvas";
  root.append(canvas);
  const plane = document.createElement("div");
  plane.className = "stage-progress-plane";
  canvas.append(plane);
  let bar: ReturnType<typeof createDomProgressBar> | undefined;
  let frame: Rect | undefined;
  let value = 0;
  return {
    get element() {
      return bar?.element;
    },
    place(rect) {
      if (
        frame !== undefined &&
        frame.height === rect.height &&
        frame.width === rect.width &&
        frame.x === rect.x &&
        frame.y === rect.y
      ) {
        return;
      }
      frame = { ...rect };
      bar?.remove();
      bar = createDomProgressBar(plane, style, rect);
      bar.element.setAttribute("aria-label", label);
      bindPalette(bar.element);
      bar.update(value);
    },
    placeCanvas(viewShift, canvas) {
      writeLayoutProperties(
        {
          "--stage-progress-canvas-height": canvas.height,
          "--stage-progress-canvas-width": canvas.width,
          "--stage-progress-shift-x": viewShift.x,
          "--stage-progress-shift-y": viewShift.y,
        },
        root,
      );
    },
    root,
    setVisible(shown) {
      root.hidden = !shown;
    },
    update(next) {
      if (!Number.isFinite(next)) {
        throw new RangeError("Stage progress must be finite");
      }
      value = next;
      bar?.update(value);
    },
  };
}
