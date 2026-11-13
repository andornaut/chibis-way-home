import { PLAY_MARK } from "../../data/layout.ts";
import type { Rect } from "../../data/types/index.ts";
import { capTop, FONT_METRICS } from "../layout/fontRoles.ts";
import type { openingLayout } from "../layout/opening.ts";
import { textButton } from "./card.ts";

export type OpeningAction = "continue" | "skip";

export interface OpeningView {
  readonly buttons: Readonly<Record<OpeningAction, HTMLButtonElement>>;
  readonly caption: HTMLElement;
  readonly mark: HTMLImageElement;
  readonly root: HTMLElement;
}

const length = (value: number) => `calc(var(--ui-unit) * ${value} * 1px)`;

function place(element: HTMLElement, rect: Rect): void {
  element.style.height = length(rect.height);
  element.style.left = length(rect.x);
  element.style.top = length(rect.y);
  element.style.width = length(rect.width);
}

// Continue leads the focus order; the shared layout places Skip to its left.
export function createOpeningView(
  document: Document,
  words: { readonly continue: string; readonly skip: string },
): OpeningView {
  const root = document.createElement("div");
  root.className = "opening-scene";
  const backdrop = document.createElement("div");
  backdrop.className = "ui-backdrop";
  const view = document.createElement("div");
  view.className = "ui-view opening-view";
  const caption = document.createElement("p");
  caption.className = "opening-caption";
  caption.setAttribute("aria-live", "polite");
  const buttons = {
    continue: textButton(document, words.continue, true),
    skip: textButton(document, words.skip),
  };
  const mark = document.createElement("img");
  mark.alt = "";
  mark.style.height = length(PLAY_MARK.height);
  mark.style.width = length(PLAY_MARK.width);
  mark.style.marginRight = length(PLAY_MARK.gap);
  buttons.continue.querySelector(".ui-text-button-label")!.prepend(mark);
  for (const [action, button] of Object.entries(buttons)) {
    button.dataset.control = action;
  }
  view.append(caption, buttons.continue, buttons.skip);
  root.append(backdrop, view);
  return { buttons, caption, mark, root };
}

export function showOpeningCaption(
  layout: ReturnType<typeof openingLayout>,
  text: string,
  view: OpeningView,
): void {
  view.caption.textContent = text;
  place(view.caption, {
    ...layout.caption,
    height: layout.caption.height + 2 * capTop(FONT_METRICS.body),
    y: layout.caption.y - capTop(FONT_METRICS.body),
  });
  for (const action of ["continue", "skip"] as const) {
    const { button: face, hit } = layout[action];
    const element = view.buttons[action];
    place(element, hit);
    // Each face keeps the canvas layout's exact press-area insets.
    element.style.padding = [
      face.y - hit.y,
      hit.x + hit.width - face.x - face.width,
      hit.y + hit.height - face.y - face.height,
      face.x - hit.x,
    ]
      .map(length)
      .join(" ");
    element.querySelector<HTMLElement>(".ui-text-button-face")!.style.width = length(face.width);
  }
}
