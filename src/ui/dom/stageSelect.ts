import { controlPresentation } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import type { PagerState } from "@andornaut/game-kit/runtime/ui/pager";
import { setButtonRole } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";
import { writeLayoutProperties } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";
import type { PagerView } from "@andornaut/game-kit/runtime/web/ui/dom/pager";
import { setTextRole } from "@andornaut/game-kit/runtime/web/ui/dom/uiTheme";

import { createGamePager, type GameAction } from "../binding/index.ts";
import {
  STAGE_FACE,
  STAGE_ROW_WIDTH,
  STAGE_SELECT_LAYOUT,
  STAGE_SELECT_WIDTH,
} from "../layout/index.ts";
import { createActions } from "./actions.ts";
import { setTextButtonRole } from "./buttonLayout.ts";
import { createCardFrame, TEXT_BUTTON_APPEARANCE } from "./card.ts";
import { registerLayout, rendered } from "./layout.ts";
import { REFUSAL_CUE } from "./refusal.ts";

// The stage picker card in the HTML UI (stageSelect.css) on the card frame: the destination's
// name, one row of stage faces per page, of which one shows, on a paged card the pager
// (Previous, the page count and Next), and the close X, last in the focus order. Each face is a
// button holding its number, its screenshot and its name, in art's ui-button, or
// ui-button-primary for the latest stage (the kit's primary button role), or the locked look; a
// locked stage is aria-disabled,
// outside the Tab order and described as locked. A pager button with no page to turn to refuses
// a press and leaves the Tab order.

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

// The pager's page, its count's words, its guard and its step, from the scene.
export interface StagePaging {
  readonly active: () => boolean;
  readonly countText: (state: PagerState) => string;
  readonly reducedMotion: () => boolean;
  readonly state: () => PagerState;
  readonly step: (direction: -1 | 1) => void;
}

export interface StageSelectView {
  readonly backdrop: HTMLElement;
  readonly close: HTMLButtonElement;
  // Each stage's screenshot, whose source the caller sets.
  readonly previews: ReadonlyMap<string, HTMLImageElement>;
  readonly dialog: HTMLElement;
  // Previous, the page count (a polite live region) and Next, on a paged card.
  readonly pager: PagerView | undefined;
  // Previous and Next as the actions the scene binds; none on a card of one page.
  readonly pagerActions: readonly GameAction[];
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
  paging: StagePaging,
  stages: readonly StageFace[],
): StageSelectView {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const frame = createCardFrame(document, {
    className: "stage-select",
    close: words.close,
    id: ID,
    title: words.title,
    width: STAGE_SELECT_WIDTH,
  });
  writeLayoutProperties(STAGE_SELECT_LAYOUT, frame.root);
  const locked = element("span", "");
  locked.id = `${ID}-locked`;
  locked.hidden = true;
  locked.textContent = words.locked;
  const buttons = new Map<string, HTMLButtonElement>();
  const previews = new Map<string, HTMLImageElement>();
  // A page's faces in catalogue order: a row group of fixed-size faces, the button gap apart.
  const pages = Array.from({ length: Math.ceil(stages.length / perPage) }, (_, index) => {
    const actions = createActions(
      document,
      stages.slice(index * perPage, (index + 1) * perPage).map((stage) => {
        const button = stageButton(element, `${ID}-locked`, words.locked, stage);
        buttons.set(stage.id, button);
        previews.set(stage.id, button.querySelector("img")!);
        return button;
      }),
      {
        className: "stage-select-page",
        context: { axis: "row" },
        size: () => STAGE_FACE,
        width: STAGE_ROW_WIDTH,
      },
    );
    frame.presses.add(actions.group);
    actions.element.hidden = true;
    return actions.element;
  });
  frame.content.append(...pages);
  let pager: PagerView | undefined;
  let pagerActions: readonly GameAction[] = [];
  if (pages.length > 1) {
    if (words.pager === undefined) {
      throw new Error("A paged stage picker requires pager labels");
    }
    const created = createGamePager(document, {
      active: paging.active,
      appearance: TEXT_BUTTON_APPEARANCE,
      className: "stage-select-pager",
      countText: paging.countText,
      labels: words.pager,
      refusal: { cue: REFUSAL_CUE, reducedMotion: paging.reducedMotion },
      state: paging.state,
      step: paging.step,
    });
    const view = created.view;
    view.count.classList.add("ui-text-body");
    setTextButtonRole(false, view.previous.element);
    setTextButtonRole(false, view.next.element);
    frame.content.append(view.element);
    frame.presses.add(view.group);
    registerLayout(() => {
      if (rendered(frame.content)) {
        view.arrange({ width: STAGE_ROW_WIDTH });
      }
    }, view.element);
    pager = view;
    pagerActions = created.actions;
  }
  frame.content.append(locked);
  return {
    backdrop: frame.backdrop,
    close: frame.close!,
    dialog: frame.dialog,
    pager,
    pagerActions,
    pages,
    previews,
    root: frame.root,
    stages: buttons,
  };
}

function stageButton(
  element: <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
  ) => HTMLElementTagNameMap[K],
  lockedId: string,
  lockedReason: string,
  stage: StageFace,
): HTMLButtonElement {
  const button = element("button", "stage-select-stage ui-button-reset");
  button.type = "button";
  button.dataset.stage = stage.id;
  setButtonRole(stage.look === "primary" ? "primary" : "secondary", button);
  const presentation = controlPresentation(
    stage.look === "locked" ? { kind: "unavailable", reason: lockedReason } : { kind: "available" },
  );
  if (!presentation.executable) {
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("aria-describedby", lockedId);
    button.tabIndex = -1;
  }
  const face = element("span", "stage-select-face");
  const number = element("span", "stage-select-number ui-button-frame-content");
  setTextRole("stageNumber", number);
  number.dataset.uiRefusalLabel = "";
  number.textContent = stage.number;
  const preview = element("span", "stage-select-preview ui-button-frame-content");
  const image = element("img", "");
  image.alt = "";
  image.draggable = false;
  preview.append(image);
  const name = element("span", "stage-select-name ui-button-frame-content ui-text-label");
  const text = element("span", "stage-select-name-text");
  text.dataset.uiRefusalLabel = "";
  text.textContent = stage.name;
  name.append(text);
  face.append(element("span", "stage-select-frame ui-button-frame"), number, preview, name);
  button.append(face);
  return button;
}
