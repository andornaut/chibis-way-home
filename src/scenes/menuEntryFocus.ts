import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

// Full-page controllers keep their internal order; the shared entry joins only at its ends.
export function menuEntryFocus(
  document: Document,
  entry: HTMLButtonElement,
  root: HTMLElement,
  event: KeyboardEvent,
): void {
  if (event.defaultPrevented || event.key !== "Tab") {
    return;
  }
  const controls = [...root.querySelectorAll<HTMLButtonElement>("button")].filter(
    (button) => !button.disabled && button.tabIndex >= 0 && button.closest("[hidden]") === null,
  );
  const edge = event.shiftKey ? controls[0] : controls.at(-1);
  const focused = document.activeElement;
  if (focused !== entry && focused !== edge) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!event.repeat) {
    const target = focused === entry ? (event.shiftKey ? controls.at(-1) : controls[0]) : entry;
    if (target !== undefined) {
      focusTarget(target);
    }
  }
}
