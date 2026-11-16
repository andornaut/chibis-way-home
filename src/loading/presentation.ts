import type { LoadingFailurePresentation } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";

import palette from "../../public/art/palette.json" with { type: "json" };
import { LOADING_FAILURE_PRESENTATION } from "../data/layout.ts";
import { SCREEN } from "../data/screen.ts";

// The existing loading rail and its failure action share the unrotated frame's CSS fit.
export function loadingUnit(frame: Pick<HTMLElement, "offsetHeight" | "offsetWidth">): number {
  return Math.min(frame.offsetWidth / SCREEN.width, frame.offsetHeight / SCREEN.height);
}

// Text and panel spacing are CSS pixels; only the logical action and its decoration scale.
export function loadingFailurePresentation(unit: number): LoadingFailurePresentation {
  const { action, panel, text } = LOADING_FAILURE_PRESENTATION;
  const { cream, forest, green, ink, plum, tan, yellow } = palette.colours;
  return {
    action: {
      borderWidthPx: action.borderWidth * unit,
      heightPx: action.height * unit,
      highlightHeightPx: action.highlightHeight * unit,
      paddingBottomPx: action.paddingBottom * unit,
      paddingXPx: action.paddingX * unit,
      shadeHeightPx: action.shadeHeight * unit,
      widthPx: action.width * unit,
    },
    palette: {
      action: green,
      actionText: ink,
      border: ink,
      highlight: yellow,
      lip: tan,
      panel: cream,
      shade: forest,
      shadow: ink,
      text: plum,
    },
    panel: { ...panel },
    text: { action: { ...text.action }, body: { ...text.body }, title: { ...text.title } },
  };
}
