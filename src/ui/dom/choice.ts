import { textButton } from "./card.ts";

// A conversation's required choice in the HTML UI (choice.css, on ui.css's .ui-card): over a
// full-area backdrop that takes every press outside it, the card on the play view in art's
// ui-settings-card frame, with the prompt and its answers stacked below it, each in art's
// ui-button. It has no title, close X or default answer: only an answer leaves it.

export interface ChoiceWords {
  // Each answer's id and label, in the order the keyboard's focus moves through them.
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly prompt: string;
}

export interface ChoiceCardView {
  readonly backdrop: HTMLElement;
  // Each answer's button, by its id.
  readonly buttons: ReadonlyMap<string, HTMLButtonElement>;
  // The card itself: role alertdialog, named by its prompt.
  readonly dialog: HTMLElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// The card for words, its dialog identified by id, which its prompt's id extends.
export function createChoiceCard(
  document: Document,
  id: string,
  words: ChoiceWords,
): ChoiceCardView {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const root = element("div", "ui-card-scene");
  const backdrop = element("div", "ui-backdrop");
  const view = element("div", "ui-view ui-card-view");
  const dialog = element("section", "ui-card ui-frame dialogue-choice");
  dialog.id = id;
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-labelledby", `${id}-prompt`);
  const prompt = element("p", "ui-card-text");
  prompt.id = `${id}-prompt`;
  prompt.textContent = words.prompt;
  const actions = element("div", "ui-card-actions");
  const buttons = new Map(
    words.options.map(({ id: answer, label }) => {
      const button = textButton(document, label);
      button.dataset.answer = answer;
      return [answer, button] as const;
    }),
  );
  actions.append(...buttons.values());
  dialog.append(prompt, actions);
  view.append(dialog);
  root.append(backdrop, view);
  return { backdrop, buttons, dialog, root };
}
