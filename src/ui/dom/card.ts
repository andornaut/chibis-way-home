// A modal card in the HTML UI (ui.css .ui-card): a scene's view holding a full-area backdrop
// that takes outside taps, and the card on the play view, in art's ui-settings-card frame, with
// its title, an optional line of text and a row of equal text buttons in art's ui-button (or
// ui-button-primary), and an optional close X in its top-right corner.

export interface CardWords<Key extends string> {
  // Each button's key and label, in the order the keyboard's focus moves through them, and
  // whether it takes art's primary button.
  readonly actions: readonly {
    readonly key: Key;
    readonly label: string;
    readonly primary?: boolean;
  }[];
  // A card the player must answer (role alertdialog) rather than one they may browse past.
  readonly alert?: boolean;
  // The close X's accessible name, for a card with one. The focus reaches it after the buttons.
  readonly close?: string;
  readonly text?: string;
  readonly title: string;
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
export function textButton(document: Document, label: string, primary = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = primary ? "ui-text-button ui-text-button-primary" : "ui-text-button";
  const face = document.createElement("span");
  face.className = "ui-text-button-face ui-frame";
  const text = document.createElement("span");
  text.className = "ui-text-button-label";
  text.textContent = label;
  face.append(text);
  button.append(face);
  return button;
}

// The close X: the button is its press area (ui.css .ui-close-button), and its face is art's
// ui-close, which the focus ring wraps. Its name is the accessible one; it shows no text.
export function closeButton(document: Document, name: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ui-close-button";
  button.setAttribute("aria-label", name);
  const face = document.createElement("span");
  face.className = "ui-close-face";
  button.append(face);
  return button;
}

// The card for words, its dialog identified by id, which its title's and text's ids extend.
export function createCard<Key extends string>(
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
  const actions = element("div", "ui-card-actions");
  const buttons = Object.fromEntries(
    words.actions.map(({ key, label, primary }) => [key, textButton(document, label, primary)]),
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
