import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import type { PauseChromeColours } from "../chrome/pauseChrome.ts";
import { createGameButton } from "../input/actionBinding.ts";
import type { StartScreenLayout } from "../layout/startScreen.ts";
import { type ActionsView, createActions } from "./actions.ts";
import { textButton } from "./card.ts";
import { createNavigationDisc } from "./navigationDisc.ts";

export type StartControl = "exit" | "restart" | "start";

export interface StartWords {
  readonly continue: string;
  readonly exit: string;
  // The logo's text alternative.
  readonly logo: string;
  // The screen's accessible name.
  readonly name: string;
  readonly restart: string;
  readonly start: string;
}

export interface StartView {
  // The footer row: Start alone, or Restart on the left and Continue on the right.
  readonly actions: ActionsView;
  readonly buttons: ReadonlyMap<StartControl, HTMLButtonElement>;
  readonly logo: HTMLImageElement;
  readonly root: HTMLElement;
}

// Each box keeps the canvas layout's logical coordinates inside the shared play view.
export function startBoxProperties(rect: Rect): LayoutValues {
  return {
    "--start-height": rect.height,
    "--start-width": rect.width,
    "--start-x": rect.x,
    "--start-y": rect.y,
  };
}

function box(rect: Rect, element: HTMLElement): void {
  writeLayoutProperties(startBoxProperties(rect), element);
  element.classList.add("start-box");
}

export function createStart(
  document: Document,
  colours: PauseChromeColours,
  words: StartWords,
  layout: StartScreenLayout,
): StartView {
  const root = document.createElement("div");
  root.className = "start-scene";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", words.name);
  const view = document.createElement("div");
  view.className = "ui-view start-view";
  const nav = document.createElement("div");
  nav.className = "start-nav ui-frame";
  box(layout.nav, nav);
  const logo = document.createElement("img");
  logo.alt = words.logo;
  logo.draggable = false;
  box(layout.logo, logo);
  // DOM order is the keyboard order, independent of the visual row order: Start, Restart, Exit.
  const buttons = new Map<StartControl, HTMLButtonElement>();
  const action = (control: "restart" | "start", label: string) => {
    const button = textButton(document, label, control === "start");
    button.dataset.control = control;
    buttons.set(control, button);
  };
  action("start", layout.saved ? words.continue : words.start);
  if (layout.saved) {
    action("restart", words.restart);
  }
  const actions = createActions(document, [...buttons.values()], {
    className: "start-actions",
    width: SCREEN.width,
  });
  writeLayoutProperties({ "--start-action-y": layout.actionY }, actions.element);
  view.append(nav, logo, actions.element);
  const at = layout.exit;
  if (at !== undefined) {
    const icon = createNavigationDisc(document, colours, "art", "rest", "exit");
    const { element: button, face } = createGameButton(
      document,
      { className: "start-icon-button ui-button-reset", face: { className: "start-icon-face" } },
      { icon, kind: "icon", name: words.exit },
    );
    button.dataset.control = "exit";
    box(at.hit, button);
    box({ ...at.art, x: at.art.x - at.hit.x, y: at.art.y - at.hit.y }, face);
    buttons.set("exit", button);
    view.append(button);
  }
  root.append(view);
  return { actions, buttons, logo, root };
}
