import type { CardWidth } from "../layout/contentCard.ts";
import { type CardView, type CardWords, setCardWidth } from "./cardElements.ts";
import { mountUiLayout } from "./layoutTree.ts";

export { type CardView, type CardWords, closeButton, setCardWidth } from "./cardElements.ts";

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

// A status message is one short line.
const MESSAGE_CARD_WIDTH: CardWidth = "small";

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
  setCardWidth(MESSAGE_CARD_WIDTH, card);
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
