import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import type { Rect } from "../../data/types/index.ts";
import type { StartScreenLayout } from "../layout/startScreen.ts";
import { textButton } from "./card.ts";

export type StartControl = "achievements" | "exit" | "restart" | "settings" | "start";

export interface StartWords {
  readonly achievements: string;
  readonly continue: string;
  readonly exit: string;
  readonly restart: string;
  readonly settings: string;
  readonly start: string;
}

export interface StartView {
  readonly buttons: ReadonlyMap<StartControl, HTMLButtonElement>;
  readonly images: ReadonlyMap<string, HTMLImageElement>;
  readonly root: HTMLElement;
}

// Each box keeps the canvas layout's logical coordinates inside the shared play view.
function box(rect: Rect, element: HTMLElement): void {
  writeLayoutProperties(
    {
      "--start-height": rect.height,
      "--start-width": rect.width,
      "--start-x": rect.x,
      "--start-y": rect.y,
    },
    element,
  );
  element.classList.add("start-box");
}

export function createStart(
  document: Document,
  words: StartWords,
  layout: StartScreenLayout,
): StartView {
  const root = document.createElement("div");
  root.className = "start-scene";
  const view = document.createElement("div");
  view.className = "ui-view start-view";
  const nav = document.createElement("div");
  nav.className = "start-nav ui-frame";
  box(layout.nav, nav);
  const images = new Map<string, HTMLImageElement>();
  const image = (key: string, rect: Rect) => {
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    box(rect, img);
    images.set(key, img);
    return img;
  };
  view.append(nav, image("logo", layout.logo));
  const buttons = new Map<StartControl, HTMLButtonElement>();
  // DOM order is the established keyboard order, independent of the visual row order.
  for (const control of ["start", "restart", "achievements", "settings", "exit"] as const) {
    const at = layout[control];
    if (at === undefined) {
      continue;
    }
    const labelled = control === "start" || control === "restart";
    const button = labelled
      ? textButton(
          document,
          control === "start" && layout.restart !== undefined ? words.continue : words[control],
          control === "start",
        )
      : document.createElement("button");
    button.type = "button";
    button.dataset.control = control;
    box(at.hit, button);
    if ("button" in at) {
      const face = button.querySelector<HTMLElement>(".ui-text-button-face")!;
      box({ ...at.button, x: at.button.x - at.hit.x, y: at.button.y - at.hit.y }, face);
    } else {
      button.classList.add("start-icon-button", "ui-press");
      button.setAttribute("aria-label", words[control]);
      const face = document.createElement("span");
      face.className = "start-icon-face";
      box({ ...at.art, x: at.art.x - at.hit.x, y: at.art.y - at.hit.y }, face);
      const icon = image(control, {
        height: 0,
        width: 0,
        x: at.icon.x - at.art.x,
        y: at.icon.y - at.art.y,
      });
      // The icon's actual source dimensions are assigned when its art frame is available.
      face.append(icon);
      button.append(face);
      writeLayoutProperties({ "--start-icon-sink": at.pressedIcon.y - at.icon.y }, button);
    }
    buttons.set(control, button);
    view.append(button);
  }
  root.append(view);
  return { buttons, images, root };
}
