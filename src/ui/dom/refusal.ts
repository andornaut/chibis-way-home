import { REFUSAL_ATTRIBUTES, refuse } from "@andornaut/game-kit/web/ui/dom/refusalCue";

import { CONTROL_REFUSAL } from "../../data/feedback";

// The refusal cue on a control that cannot act (the kit's refusalCue, drawn by its ui.css): the
// control glides out and back CONTROL_REFUSAL.shake base px once per shakeMs while its labels
// (marked data-ui-refusal-label) and its own colour flash red, flashes steps of flashMs. With
// reduced motion it holds red for the same time and does not move. Faces must not draw in
// currentColor, which turns red too.
const CUE = {
  shake: CONTROL_REFUSAL.shake,
  shakeMs: CONTROL_REFUSAL.shakeMs,
  shakeShape: "yoyo",
  stepMs: CONTROL_REFUSAL.flashMs,
  steps: CONTROL_REFUSAL.flashes,
} as const;

// Whether the cue is playing on element.
export function refusing(element: HTMLElement): boolean {
  return (
    element.hasAttribute(REFUSAL_ATTRIBUTES.red) || element.hasAttribute(REFUSAL_ATTRIBUTES.shake)
  );
}

// Plays the cue on element unless it is already playing there, and returns a function that stops
// it at once.
export function refuseControl(reducedMotion: boolean, element: HTMLElement): () => void {
  return refusing(element) ? () => undefined : refuse(CUE, reducedMotion, element);
}
