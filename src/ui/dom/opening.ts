import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { CARD_CONTENT, TEXT_BUTTON } from "../../data/layout.ts";
import { type ActionsView, createActions } from "./actions.ts";
import { textButton } from "./card.ts";

export type OpeningAction = "continue" | "previous" | "skip";

export const OPENING_PROPERTIES: LayoutValues = {
  "--opening-footer-height": TEXT_BUTTON.height + 2 * CARD_CONTENT.padding,
};

export interface OpeningView {
  // Previous and Next in the footer, with Skip in its own top-right action group.
  readonly actions: ActionsView;
  readonly buttons: Readonly<Record<OpeningAction, HTMLButtonElement>>;
  readonly caption: HTMLElement;
  readonly root: HTMLElement;
}

export interface OpeningWords {
  readonly continue: string;
  // The screen's accessible name.
  readonly name: string;
  readonly previous: string;
  readonly skip: string;
}

// Next leads the focus order, with the primary face drawn to the right of Previous.
export function createOpeningView(document: Document, words: OpeningWords): OpeningView {
  const root = document.createElement("div");
  root.className = "opening-scene";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", words.name);
  writeLayoutProperties(OPENING_PROPERTIES, root);
  const backdrop = document.createElement("div");
  backdrop.className = "ui-backdrop";
  const view = document.createElement("div");
  view.className = "ui-view opening-view";
  const footer = document.createElement("div");
  footer.className = "opening-footer";
  const caption = document.createElement("p");
  caption.className = "opening-caption ui-text-body";
  caption.setAttribute("aria-live", "polite");
  const buttons = {
    continue: textButton(document, words.continue, true),
    previous: textButton(document, words.previous),
    skip: textButton(document, words.skip),
  };
  for (const [action, button] of Object.entries(buttons)) {
    button.dataset.control = action;
  }
  buttons.previous.hidden = true;
  const actions = createActions(document, [buttons.continue, buttons.previous], {
    className: "opening-actions",
    width: "content",
  });
  const skip = createActions(document, [buttons.skip], {
    className: "opening-skip",
    width: "content",
  });
  footer.append(caption, actions.element);
  view.append(footer, skip.element);
  root.append(backdrop, view);
  return { actions, buttons, caption, root };
}

export function showOpeningCaption(text: string, view: OpeningView): void {
  view.caption.textContent = text;
}
