import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";

import { focusKeyAction } from "../ui/index.ts";

// Vertical focus and Tab join the shared entry at the page ends; horizontal page controls keep
// their own navigation, including the map destinations.
export function menuEntryFocus(
  document: Document,
  entry: HTMLButtonElement,
  root: HTMLElement,
  event: KeyboardEvent,
): void {
  const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
  if (
    event.defaultPrevented ||
    !["Tab", "ArrowUp", "ArrowDown"].includes(event.key) ||
    (action !== "next" && action !== "previous")
  ) {
    return;
  }
  const controls = [...root.querySelectorAll<HTMLButtonElement>("button")].filter(
    (button) => !button.disabled && button.tabIndex >= 0 && button.closest("[hidden]") === null,
  );
  const backwards = action === "previous";
  const edge = backwards ? controls[0] : controls.at(-1);
  const focused = document.activeElement;
  if (focused !== entry && focused !== edge) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!event.repeat) {
    const target = focused === entry ? (backwards ? controls.at(-1) : controls[0]) : entry;
    if (target !== undefined) {
      focusTarget(target);
    }
  }
}
