import { onBarePage } from "@andornaut/game-kit/runtime/web/input/dom/pagePresses";

import { isGameplayKey } from "./intent.ts";

export function gameplayKeyHandlers(
  accepts: (event: KeyboardEvent) => boolean,
  canvas: HTMLCanvasElement,
  held: Set<string>,
) {
  const host = canvas.parentElement;
  const document = canvas.ownerDocument;
  const bare = [document.body, document.documentElement, host, canvas];
  // Keep Enter and Space native on a focused HUD button. The other play shortcuts still
  // work from that button when Pause restores focus.
  const targetInPlay = ({ code, target }: KeyboardEvent) =>
    onBarePage(bare, target) ||
    (code !== "Enter" &&
      code !== "Space" &&
      target instanceof HTMLButtonElement &&
      host?.contains(target) === true);

  return {
    down(event: KeyboardEvent) {
      if (
        isGameplayKey(event.code) &&
        !event.defaultPrevented &&
        !event.isComposing &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        targetInPlay(event) &&
        accepts(event)
      ) {
        event.preventDefault();
        // Repeats never revive keys cleared by a modal or focus change.
        if (!event.repeat) {
          held.add(event.code);
        }
      }
    },
    up(event: KeyboardEvent) {
      if (isGameplayKey(event.code)) {
        held.delete(event.code);
      }
    },
  };
}
