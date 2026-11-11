// A modal card in the HTML UI (ui.css .ui-card): a scene's view holding a full-area backdrop
// that takes outside taps, and the card on the play view, in art's ui-settings-card frame, with
// its title, one line of text and a row of equal text buttons in art's ui-button.

export interface CardWords<Key extends string> {
  // Each button's key and label, in the order the keyboard's focus moves through them.
  readonly actions: readonly { readonly key: Key; readonly label: string }[];
  readonly text: string;
  readonly title: string;
}

export interface CardView<Key extends string> {
  readonly backdrop: HTMLElement;
  readonly buttons: Readonly<Record<Key, HTMLButtonElement>>;
  // The card itself: role dialog, named by its title and described by its text.
  readonly dialog: HTMLElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// A text button: the button is its press area (ui.css .ui-text-button), and its face is art's
// frame with the label, which the focus ring wraps.
function textButton(document: Document, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ui-text-button";
  const face = document.createElement("span");
  face.className = "ui-text-button-face ui-frame";
  const text = document.createElement("span");
  text.className = "ui-text-button-label";
  text.textContent = label;
  face.append(text);
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
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  dialog.setAttribute("aria-describedby", `${id}-text`);
  const title = element("h2", "ui-card-title");
  title.id = `${id}-title`;
  title.textContent = words.title;
  const text = element("p", "ui-card-text");
  text.id = `${id}-text`;
  text.textContent = words.text;
  const actions = element("div", "ui-card-actions");
  const buttons = Object.fromEntries(
    words.actions.map(({ key, label }) => [key, textButton(document, label)]),
  ) as Record<Key, HTMLButtonElement>;
  actions.append(...words.actions.map(({ key }) => buttons[key]));
  dialog.append(title, text, actions);
  view.append(dialog);
  root.append(backdrop, view);
  return { backdrop, buttons, dialog, root };
}

// Shows each text button under root pressed (data-pressed) from a pointer's press on it, while
// accepts holds, until that pointer lifts or cancels anywhere. A touch press is released from
// the implicit capture of the control it lands on, so a press that lifts off its button never
// clicks it, as with a mouse. Returns its removal.
export function showPresses(accepts: () => boolean, root: HTMLElement): () => void {
  const document = root.ownerDocument;
  const pressed = new Map<number, HTMLElement>();
  const onDown = (event: PointerEvent) => {
    const { pointerId, target } = event;
    if (target instanceof Element && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    const button = (event.target as Element | null)?.closest?.(".ui-text-button");
    if (button instanceof HTMLElement && root.contains(button) && accepts()) {
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
