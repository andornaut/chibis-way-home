import { createGameButton } from "../input/actionBinding.ts";
import type { CardWidth } from "../layout/contentCard.ts";
import { setTextButtonRole } from "./buttonLayout.ts";

// A modal card in the HTML UI (ui.css .ui-card): a scene's view holding a full-area backdrop
// that takes outside taps, and the card on the play view, in art's ui-settings-card frame, at its
// width family's width, with its title, an optional line of text and a row of equal text buttons
// in art's ui-button (or ui-button-primary), and an optional close X in its top-right corner.

export interface CardWords<Key extends string> {
  // Each button's key and label, in the order the keyboard's focus moves through them, and
  // whether it takes art's primary button.
  readonly actions: readonly {
    readonly key: Key;
    readonly label: string;
    readonly primary?: boolean;
  }[];
  // Action orientation; stacked actions share full-width faces and canonical spacing.
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
  readonly backdrop: HTMLElement;
  readonly buttons: Readonly<Record<Key, HTMLButtonElement>>;
  readonly close?: HTMLButtonElement;
  // The card itself: role dialog, named by its title and described by its text.
  readonly dialog: HTMLElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// A text button: the button is its press area (ui.css .ui-text-button), and its face is art's
// frame with the label, which the focus ring wraps.
export function createTextButtonElement(
  document: Document,
  label: string,
  primary = false,
): HTMLButtonElement {
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

// Sizes card, a .ui-card, at family's width (ui.css).
export function setCardWidth(family: CardWidth, card: HTMLElement): void {
  card.dataset.cardWidth = family;
}

// The close X: the button is its press area (ui.css .ui-close-button), and its face is art's
// ui-close, which the focus ring wraps. Its name is the accessible one; it shows no text.
export function closeButton(document: Document, name: string): HTMLButtonElement {
  return createGameButton(
    document,
    { className: "ui-close-button", face: { className: "ui-close-face" } },
    { kind: "icon", name },
  ).element;
}

// The card for words, its dialog identified by id, which its title's and text's ids extend.
export function createCardElement<Key extends string>(
  document: Document,
  id: string,
  words: CardWords<Key>,
): CardView<Key> {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const root = element("div", "ui-card-scene");
  const backdrop = element("div", "ui-backdrop");
  const view = element("div", "ui-view ui-card-view");
  const dialog = element("section", "ui-card ui-frame");
  setCardWidth(words.width, dialog);
  dialog.id = id;
  dialog.setAttribute("role", words.alert === true ? "alertdialog" : "dialog");
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  const title = element("h2", "ui-card-title");
  title.id = `${id}-title`;
  title.textContent = words.title;
  if (words.close === undefined) {
    dialog.append(title);
  } else {
    const header = element("div", "ui-card-header");
    header.append(title);
    dialog.append(header);
  }
  if (words.text !== undefined) {
    dialog.setAttribute("aria-describedby", `${id}-text`);
    const text = element("p", "ui-card-text");
    text.id = `${id}-text`;
    text.textContent = words.text;
    dialog.append(text);
  }
  const actions = element("div", "ui-card-actions ui-control-group");
  actions.dataset.uiAxis = words.actionsLayout === "stack" ? "stack" : "row";
  actions.classList.toggle("ui-button-stack", words.actionsLayout === "stack");
  const buttons = Object.fromEntries(
    words.actions.map(({ key, label, primary }) => [
      key,
      createTextButtonElement(document, label, primary),
    ]),
  ) as Record<Key, HTMLButtonElement>;
  actions.append(...words.actions.map(({ key }) => buttons[key]));
  dialog.append(actions);
  const close = words.close === undefined ? undefined : closeButton(document, words.close);
  if (close !== undefined) {
    dialog.classList.add("ui-card-closeable");
    // After the buttons, so the keyboard's focus reaches it last.
    dialog.append(close);
  }
  view.append(dialog);
  root.append(backdrop, view);
  return { backdrop, buttons, ...(close && { close }), dialog, root };
}
