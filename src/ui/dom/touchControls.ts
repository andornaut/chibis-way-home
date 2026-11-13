import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import type { Point, Size } from "../../data/types/index.ts";
import {
  TOUCH_CHROME_FRAME,
  TOUCH_KNOB_FRAME,
  type TouchChromeColours,
  type TouchChromeKind,
  touchChromeLayers,
  type TouchChromePose,
} from "../chrome/touchChrome.ts";
import { centredAt } from "../chrome/touchControls.ts";
import { createPaletteSvg } from "./chrome.ts";

export const TOUCH_CONTROLS_PROPERTIES: LayoutValues = {
  "--touch-canvas-height": 0,
  "--touch-canvas-width": 0,
  "--touch-control-opacity": 0.85,
  "--touch-control-size": TOUCH_CHROME_FRAME,
  "--touch-control-x": 0,
  "--touch-control-y": 0,
  "--touch-view-shift-x": 0,
  "--touch-view-shift-y": 0,
};

export interface TouchControlVisual {
  // The current canvas-base centre, including the play view's shift.
  readonly centre: Point;
  // Only the first frame of the existing press animation expands the ring.
  readonly expanded: boolean;
  readonly pose: TouchChromePose;
  readonly shown: boolean;
}

export interface TouchControlsState {
  readonly canvas: Size;
  readonly controls: Readonly<Record<TouchChromeKind, TouchControlVisual>>;
  // Removed from the layer's play-view origin exactly once to recover the canvas origin.
  readonly viewShift: Point;
}

export interface TouchControlsView {
  readonly parts: Readonly<Record<TouchChromeKind, HTMLElement>>;
  readonly root: HTMLElement;
  render(state: TouchControlsState): void;
}

// Decorative touch chrome only. The scene retains its animation clock, visibility policy and
// window input geometry; this view draws its supplied pose and clips it to the whole canvas.
export function createTouchControls(
  document: Document,
  colours: TouchChromeColours,
): TouchControlsView {
  const root = document.createElement("div");
  root.className = "touch-controls-scene";
  root.setAttribute("aria-hidden", "true");
  writeLayoutProperties(TOUCH_CONTROLS_PROPERTIES, root);
  const kinds: readonly TouchChromeKind[] = ["jump", "use", "knob", "move"];
  const parts = Object.fromEntries(
    kinds.map((kind) => {
      const part = document.createElement("span");
      part.className = "touch-control";
      part.dataset.touchControl = kind;
      part.hidden = true;
      const size = kind === "knob" ? TOUCH_KNOB_FRAME : TOUCH_CHROME_FRAME;
      writeLayoutProperties({ "--touch-control-size": size }, part);
      root.append(part);
      return [kind, part];
    }),
  ) as Record<TouchChromeKind, HTMLElement>;
  const looks = new Map<TouchChromeKind, string>();
  return {
    parts,
    render({ canvas, controls, viewShift }) {
      writeLayoutProperties(
        {
          "--touch-canvas-height": canvas.height,
          "--touch-canvas-width": canvas.width,
          "--touch-view-shift-x": viewShift.x,
          "--touch-view-shift-y": viewShift.y,
        },
        root,
      );
      for (const kind of kinds) {
        const visual = controls[kind];
        const part = parts[kind];
        const size = kind === "knob" ? TOUCH_KNOB_FRAME : TOUCH_CHROME_FRAME;
        const at = centredAt(visual.centre, {
          height: size,
          width: size,
        });
        writeLayoutProperties({ "--touch-control-x": at.x, "--touch-control-y": at.y }, part);
        part.hidden = !visual.shown;
        const look = `${visual.pose}:${visual.expanded}`;
        if (looks.get(kind) !== look) {
          part.replaceChildren(
            createPaletteSvg(
              document,
              colours,
              { height: size, width: size },
              touchChromeLayers(colours, kind, visual.pose, visual.expanded),
            ),
          );
          looks.set(kind, look);
        }
      }
    },
    root,
  };
}
