import { createGameButton } from "../input/actionBinding.ts";
import type { CardWidth } from "../layout/contentCard.ts";
import { type ActionsView, createActions } from "./actions.ts";
import { setTextButtonRole } from "./buttonLayout.ts";
import { type CardFrame, createCardFrame } from "./cardFrame.ts";

export { setCardWidth } from "./cardElements.ts";
export { type CardFrame, closeButton, createCardFrame } from "./cardFrame.ts";

// A modal card of words in the HTML UI (cardFrame.ts): its title, optional text and its actions
// in a row or a stack, with an optional close X.

export interface CardWords<Key extends string> {
  // Each button's key and label, in the order the keyboard's focus moves through them, and
  // whether it takes art's primary button.
  readonly actions: readonly {
    readonly key: Key;
    readonly label: string;
    readonly primary?: boolean;
  }[];
  // Action orientation; stacked actions share full-width faces.
  readonly actionsLayout?: "row" | "stack";
  // A card the player must answer (role alertdialog) rather than one they may browse past.
  readonly alert?: boolean;
  // The close X's accessible name, for a card with one. The focus reaches it after the buttons.
  readonly close?: string;
  readonly text?: string;
  readonly title: string;
  readonly width: CardWidth;
}

export interface CardView<Key extends string> {
  readonly actions: ActionsView;
  readonly backdrop: HTMLElement;
  readonly buttons: Readonly<Record<Key, HTMLButtonElement>>;
  readonly close?: HTMLButtonElement;
  // The card itself: role dialog, named by its title and described by its text.
  readonly dialog: HTMLElement;
  readonly frame: CardFrame;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// A text button: its box is its face, art's frame with the label; the group that holds it gives
// it its press area.
export function textButton(document: Document, label: string, primary = false): HTMLButtonElement {
  const { element: button } = createGameButton(
    document,
    {
      className: primary ? "ui-text-button ui-text-button-primary" : "ui-text-button",
      contentClassName: "ui-text-button-label",
      face: { className: "ui-text-button-face ui-frame ui-control-button" },
    },
    { kind: "text", label },
  );
  setTextButtonRole(primary, button);
  return button;
}

// Sets a text button's label.
export function setTextButtonLabel(label: string, button: HTMLButtonElement): void {
  button.querySelector(".ui-text-button-label")!.textContent = label;
}

// The card for words, its dialog identified by id, which its title's and text's ids extend.
export function createCard<Key extends string>(
  document: Document,
  id: string,
  words: CardWords<Key>,
): CardView<Key> {
  const frame = createCardFrame(document, {
    ...(words.alert === undefined ? {} : { alert: words.alert }),
    ...(words.close === undefined ? {} : { close: words.close }),
    ...(words.text === undefined ? {} : { description: words.text }),
    id,
    title: words.title,
    width: words.width,
  });
  const buttons = Object.fromEntries(
    words.actions.map(({ key, label, primary }) => [key, textButton(document, label, primary)]),
  ) as Record<Key, HTMLButtonElement>;
  const actions = createActions(
    document,
    words.actions.map(({ key }) => buttons[key]),
    {
      className: "ui-card-actions",
      context: words.actionsLayout === "stack" ? { axis: "stack", stackWidth: "fill" } : {},
    },
  );
  frame.content.append(actions.element);
  return {
    actions,
    backdrop: frame.backdrop,
    buttons,
    ...(frame.close === undefined ? {} : { close: frame.close }),
    dialog: frame.dialog,
    frame,
    root: frame.root,
  };
}

// A card holding one line of text over a backdrop that takes every tap: a status message with no
// title, buttons or close X. Returns the scene's view, which the UI layer mounts.
export function createMessageCard(document: Document, id: string, text: string): HTMLElement {
  const frame = createCardFrame(document, { id, width: "small" });
  frame.dialog.setAttribute("role", "status");
  const message = document.createElement("p");
  message.className = "ui-card-text ui-text-body";
  message.textContent = text;
  frame.content.append(message);
  return frame.root;
}
