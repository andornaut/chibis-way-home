import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { STAGE_SELECT_LAYOUT } from "../layout/stageSelectCard.ts";
import { closeButton, textButton } from "./card.ts";

// The stage picker card in the HTML UI (stageSelect.css): the destination's name, the close X,
// one row of stage faces per page, of which one shows, and on a paged card Previous, the page
// count and Next. Each face is a button holding its number, its screenshot and its name, in art's
// ui-button, or ui-button-primary for the latest stage, or the locked look; a locked stage is
// aria-disabled, outside the Tab order and described as locked.

export type StageLook = "locked" | "normal" | "primary";

export interface StageFace {
  readonly id: string;
  readonly look: StageLook;
  readonly name: string;
  readonly number: string;
}

export interface StageSelectWords {
  // The close X's accessible name.
  readonly close: string;
  // A locked stage's accessible description.
  readonly locked: string;
  // Previous and Next, on a paged card.
  readonly pager?: { readonly next: string; readonly previous: string };
  readonly title: string;
}

export interface StageSelectView {
  readonly backdrop: HTMLElement;
  readonly close: HTMLButtonElement;
  // Each stage's screenshot, whose source the caller sets.
  readonly previews: ReadonlyMap<string, HTMLImageElement>;
  // The page count, a polite live region, on a paged card.
  readonly count: HTMLElement | undefined;
  readonly dialog: HTMLElement;
  readonly pager:
    { readonly next: HTMLButtonElement; readonly previous: HTMLButtonElement } | undefined;
  // Each page's row of faces.
  readonly pages: readonly HTMLElement[];
  readonly root: HTMLElement;
  readonly stages: ReadonlyMap<string, HTMLButtonElement>;
}

const ID = "stage-select";

// The card for words and the catalogue's stages, perPage to a page, every page hidden.
export function createStageSelect(
  document: Document,
  words: StageSelectWords,
  perPage: number,
  stages: readonly StageFace[],
): StageSelectView {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const root = element("div", "ui-card-scene");
  writeLayoutProperties(STAGE_SELECT_LAYOUT, root);
  const backdrop = element("div", "ui-backdrop");
  const view = element("div", "ui-view ui-card-view");
  const dialog = element("section", "ui-card ui-card-closeable ui-frame stage-select");
  dialog.id = ID;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", `${ID}-title`);
  const title = element("h2", "ui-card-title stage-select-title");
  title.id = `${ID}-title`;
  title.textContent = words.title;
  const locked = element("span", "");
  locked.id = `${ID}-locked`;
  locked.hidden = true;
  locked.textContent = words.locked;
  const close = closeButton(document, words.close);
  const buttons = new Map<string, HTMLButtonElement>();
  const previews = new Map<string, HTMLImageElement>();
  const pages = Array.from({ length: Math.ceil(stages.length / perPage) }, (_, index) => {
    const page = element("div", "stage-select-page");
    page.hidden = true;
    page.append(
      ...stages.slice(index * perPage, (index + 1) * perPage).map((stage) => {
        const button = stageButton(element, `${ID}-locked`, stage);
        buttons.set(stage.id, button);
        previews.set(stage.id, button.querySelector("img")!);
        return button;
      }),
    );
    return page;
  });
  dialog.append(title, close, ...pages, locked);
  let pager: StageSelectView["pager"];
  let count: HTMLElement | undefined;
  if (pages.length > 1) {
    if (words.pager === undefined) {
      throw new Error("A paged stage picker requires pager labels");
    }
    const pageButton = (label: string) => {
      const button = textButton(document, label);
      button.querySelector<HTMLElement>(".ui-text-button-label")!.dataset.uiRefusalLabel = "";
      return button;
    };
    pager = { next: pageButton(words.pager.next), previous: pageButton(words.pager.previous) };
    count = element("p", "stage-select-count");
    count.setAttribute("aria-live", "polite");
    const row = element("div", "stage-select-pager");
    row.append(pager.previous, count, pager.next);
    dialog.append(row);
  }
  view.append(dialog);
  root.append(backdrop, view);
  return { backdrop, close, count, dialog, pager, pages, previews, root, stages: buttons };
}

function stageButton(
  element: <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
  ) => HTMLElementTagNameMap[K],
  lockedId: string,
  stage: StageFace,
): HTMLButtonElement {
  const button = element("button", "stage-select-stage ui-press");
  button.type = "button";
  button.dataset.stage = stage.id;
  button.dataset.look = stage.look;
  if (stage.look === "locked") {
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("aria-describedby", lockedId);
    button.tabIndex = -1;
  }
  const face = element("span", "stage-select-face");
  const number = element("span", "stage-select-number");
  number.dataset.uiRefusalLabel = "";
  number.textContent = stage.number;
  const preview = element("span", "stage-select-preview");
  const image = element("img", "");
  image.alt = "";
  image.draggable = false;
  preview.append(image);
  const name = element("span", "stage-select-name");
  const text = element("span", "stage-select-name-text");
  text.dataset.uiRefusalLabel = "";
  text.textContent = stage.name;
  name.append(text);
  face.append(element("span", "stage-select-frame ui-frame"), number, preview, name);
  button.append(face);
  return button;
}
