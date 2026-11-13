import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { CARD_CONTENT, PLAY_MARK, TEXT_BUTTON } from "../../data/layout.ts";
import { textButton } from "./card.ts";

export type OpeningAction = "continue" | "skip";

export const OPENING_PROPERTIES: LayoutValues = {
  "--opening-footer-height": TEXT_BUTTON.height + 2 * CARD_CONTENT.padding,
  "--opening-mark-gap": PLAY_MARK.gap,
  "--opening-mark-height": PLAY_MARK.height,
  "--opening-mark-lead": PLAY_MARK.width + PLAY_MARK.gap,
  "--opening-mark-width": PLAY_MARK.width,
};

export interface OpeningView {
  readonly buttons: Readonly<Record<OpeningAction, HTMLButtonElement>>;
  readonly caption: HTMLElement;
  readonly mark: HTMLImageElement;
  readonly root: HTMLElement;
}

// Native text determines both equal-width faces. Continue leads the focus order, with Skip left.
export function createOpeningView(
  document: Document,
  words: { readonly continue: string; readonly skip: string },
): OpeningView {
  const root = document.createElement("div");
  root.className = "opening-scene";
  writeLayoutProperties(OPENING_PROPERTIES, root);
  const backdrop = document.createElement("div");
  backdrop.className = "ui-backdrop";
  const view = document.createElement("div");
  view.className = "ui-view opening-view";
  const footer = document.createElement("div");
  footer.className = "opening-footer";
  const caption = document.createElement("p");
  caption.className = "opening-caption";
  caption.setAttribute("aria-live", "polite");
  const buttons = {
    continue: textButton(document, words.continue, true),
    skip: textButton(document, words.skip),
  };
  const mark = document.createElement("img");
  mark.alt = "";
  buttons.continue.querySelector(".ui-text-button-label")!.prepend(mark);
  for (const [action, button] of Object.entries(buttons)) {
    button.dataset.control = action;
  }
  const actions = document.createElement("div");
  actions.className = "ui-card-actions opening-actions";
  actions.append(buttons.continue, buttons.skip);
  footer.append(caption, actions);
  view.append(footer);
  root.append(backdrop, view);
  return { buttons, caption, mark, root };
}

export function showOpeningCaption(text: string, view: OpeningView): void {
  view.caption.textContent = text;
}
