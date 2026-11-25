import { ACTION_GAPS } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { createActionGroup } from "@andornaut/game-kit/runtime/web/ui/dom/actionGroup";
import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { CARD_CONTENT, PLAY_MARK, TEXT_BUTTON } from "../../data/layout.ts";
import { type ActionsView, measuredActions } from "./actions.ts";
import { textButton } from "./card.ts";
import { registerLayout, rendered } from "./layout.ts";

export type OpeningAction = "continue" | "skip";

export const OPENING_PROPERTIES: LayoutValues = {
  "--opening-footer-height": TEXT_BUTTON.height + 2 * CARD_CONTENT.padding,
  "--opening-mark-gap": PLAY_MARK.gap,
  "--opening-mark-height": PLAY_MARK.height,
  "--opening-mark-width": PLAY_MARK.width,
};

export interface OpeningView {
  // The footer row: Skip on the left and Continue on the right.
  readonly actions: ActionsView;
  readonly buttons: Readonly<Record<OpeningAction, HTMLButtonElement>>;
  readonly caption: HTMLElement;
  readonly mark: HTMLImageElement;
  readonly root: HTMLElement;
}

export interface OpeningWords {
  readonly continue: string;
  // The screen's accessible name.
  readonly name: string;
  readonly skip: string;
}

// The width of a row of faces side by side, the standard gap apart.
export function openingActionsWidth(widths: readonly number[]): number {
  return (
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, widths.length - 1) * ACTION_GAPS.standard.row
  );
}

// A row group exactly as wide as its faces and gaps, so the footer's layout anchors it.
function contentActions(
  document: Document,
  className: string,
  elements: readonly HTMLElement[],
): ActionsView {
  const group = createActionGroup(document, { className });
  group.element.append(...elements);
  const arrange = () => {
    if (!rendered(group.element.parentElement ?? group.element)) {
      return undefined;
    }
    const actions = measuredActions(group, elements);
    const shown = actions.filter(({ element }) => !element.hidden);
    return group.arrange(
      { axis: "row", width: openingActionsWidth(shown.map(({ size }) => size.width)) },
      actions,
    );
  };
  registerLayout(arrange, group.element);
  return { arrange, element: group.element, group };
}

// The footer holds the caption and, at its right, the action row sized to its faces. Continue
// leads the focus order; the group shows it on the right, after Skip.
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
    skip: textButton(document, words.skip),
  };
  buttons.continue.dataset.control = "continue";
  buttons.skip.dataset.control = "skip";
  const mark = document.createElement("img");
  mark.alt = "";
  buttons.continue.querySelector(".ui-text-button-label")!.prepend(mark);
  const actions = contentActions(document, "opening-actions", [buttons.continue, buttons.skip]);
  footer.append(caption, actions.element);
  view.append(footer);
  root.append(backdrop, view);
  return { actions, buttons, caption, mark, root };
}

export function showOpeningCaption(text: string, view: OpeningView): void {
  view.caption.textContent = text;
}
