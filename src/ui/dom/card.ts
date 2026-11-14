import type { CardView, CardWords } from "./cardElements.ts";
import { mountUiLayout } from "./layoutTree.ts";

export { type CardView, type CardWords, closeButton } from "./cardElements.ts";

// Detached materialization uses the same typed production ports as composed screen trees.
export function textButton(document: Document, label: string, primary = false): HTMLButtonElement {
  let button: HTMLButtonElement | undefined;
  mountUiLayout(document, document.createElement("div"), {
    component: "Button",
    key: "button",
    kind: "component",
    props: {
      label,
      primary,
      ref: (element) => {
        button = element;
      },
    },
  });
  return button!;
}

export function createCard<Key extends string>(
  document: Document,
  id: string,
  words: CardWords<Key>,
): CardView<Key> {
  let view: CardView<string> | undefined;
  mountUiLayout(document, document.createElement("div"), {
    component: "Card",
    key: id,
    kind: "component",
    props: {
      id,
      ref: (created) => {
        view = created;
      },
      words,
    },
  });
  return view!;
}

// Shows each enabled text button, close X and other control marked .ui-press under root pressed
// (data-pressed) from a pointer's press on it, while accepts holds, until that pointer lifts or
// cancels anywhere; an aria-disabled one never shows pressed. A touch press is released from the
// implicit capture of the control it lands on, so a press that lifts off its button never clicks
// it, as with a mouse. Returns its removal.
export function showPresses(accepts: () => boolean, root: HTMLElement): () => void {
  const document = root.ownerDocument;
  const pressed = new Map<number, HTMLElement>();
  const onDown = (event: PointerEvent) => {
    const { pointerId, target } = event;
    if (target instanceof Element && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    const button = (event.target as Element | null)?.closest?.(
      ".ui-text-button, .ui-close-button, .ui-press",
    );
    if (
      button instanceof HTMLButtonElement &&
      !button.disabled &&
      button.getAttribute("aria-disabled") !== "true" &&
      root.contains(button) &&
      accepts()
    ) {
      pressed.set(event.pointerId, button);
      button.dataset.pressed = "";
    }
  };
  const onEnd = (event: PointerEvent) => {
    const button = pressed.get(event.pointerId);
    pressed.delete(event.pointerId);
    if (button !== undefined && ![...pressed.values()].includes(button)) {
      delete button.dataset.pressed;
    }
  };
  root.addEventListener("pointerdown", onDown);
  document.addEventListener("pointerup", onEnd, true);
  document.addEventListener("pointercancel", onEnd, true);
  return () => {
    root.removeEventListener("pointerdown", onDown);
    document.removeEventListener("pointerup", onEnd, true);
    document.removeEventListener("pointercancel", onEnd, true);
  };
}

// A card holding one line of text, in the same frame and text style as createCard's, over a
// backdrop that takes every tap: a status message with no title, buttons or close X. Returns the
// scene's view, which the UI layer mounts.
export function createMessageCard(document: Document, id: string, text: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "ui-card-scene";
  const backdrop = document.createElement("div");
  backdrop.className = "ui-backdrop";
  const view = document.createElement("div");
  view.className = "ui-view ui-card-view";
  const card = document.createElement("section");
  card.className = "ui-card ui-frame";
  card.id = id;
  card.setAttribute("role", "status");
  const message = document.createElement("p");
  message.className = "ui-card-text";
  message.textContent = text;
  card.append(message);
  view.append(card);
  root.append(backdrop, view);
  return root;
}
