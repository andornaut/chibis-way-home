import { type ActionsView, createActions } from "./actions.ts";
import { textButton } from "./card.ts";
import { createCardFrame } from "./cardFrame.ts";

// A conversation's required choice in the HTML UI (cardFrame.ts): the prompt, one centred line,
// over its answers stacked at the card's full content width, each in art's ui-button. It has no
// title, close X or default answer: only an answer leaves it.

export interface ChoiceWords {
  // Each answer's id and label, in the order the keyboard's focus moves through them.
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly prompt: string;
}

export interface ChoiceCardView {
  // The answers' group.
  readonly actions: ActionsView;
  readonly backdrop: HTMLElement;
  // Each answer's button, by its id.
  readonly buttons: ReadonlyMap<string, HTMLButtonElement>;
  // The card itself: role alertdialog, named by its prompt.
  readonly dialog: HTMLElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
}

// The card for words, its dialog identified by id and named by its prompt.
export function createChoiceCard(
  document: Document,
  id: string,
  words: ChoiceWords,
): ChoiceCardView {
  // A prompt over stacked answers.
  const frame = createCardFrame(document, {
    alert: true,
    className: "dialogue-choice",
    id,
    label: words.prompt,
    width: "small",
  });
  const prompt = document.createElement("p");
  prompt.className = "ui-card-text ui-text-body";
  prompt.textContent = words.prompt;
  const buttons = new Map(
    words.options.map(({ id: answer, label }) => {
      const button = textButton(document, label);
      button.dataset.answer = answer;
      return [answer, button] as const;
    }),
  );
  const actions = createActions(document, [...buttons.values()], {
    className: "ui-card-actions",
    context: { axis: "stack", stackWidth: "fill" },
  });
  frame.content.append(prompt, actions.element);
  return { actions, backdrop: frame.backdrop, buttons, dialog: frame.dialog, root: frame.root };
}
