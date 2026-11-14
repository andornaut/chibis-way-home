import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import type { Rect } from "../../data/types/index.ts";
import type { StartScreenLayout } from "../layout/startScreen.ts";
import { mountUiLayout, type UiLayoutNode } from "./layoutTree.ts";

export type StartControl = "achievements" | "exit" | "restart" | "start";

export interface StartWords {
  readonly achievements: string;
  readonly continue: string;
  readonly exit: string;
  readonly restart: string;
  readonly start: string;
}

export interface StartView {
  readonly buttons: ReadonlyMap<StartControl, HTMLButtonElement>;
  readonly images: ReadonlyMap<string, HTMLImageElement>;
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

export function startIconProperties(sink: number, rect: Rect): LayoutValues {
  return { ...startBoxProperties(rect), "--start-icon-sink": sink };
}

function box(rect: Rect, element: HTMLElement): void {
  writeLayoutProperties(startBoxProperties(rect), element);
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
  const children: UiLayoutNode[] = [
    { component: "Native", key: "nav", kind: "component", props: { element: nav } },
    {
      component: "Native",
      key: "logo",
      kind: "component",
      props: { element: image("logo", layout.logo) },
    },
  ];
  const buttons = new Map<StartControl, HTMLButtonElement>();
  // DOM order is the established keyboard order, independent of the visual row order.
  const order = ["start", "restart", "achievements", "exit"] as const;
  for (const control of order) {
    const at = layout[control];
    if (at === undefined) {
      continue;
    }
    if ("button" in at) {
      children.push({
        component: "Button",
        key: control,
        kind: "component",
        props: {
          control,
          label:
            control === "start" && layout.restart !== undefined ? words.continue : words[control],
          primary: control === "start",
          ref: (button) => {
            box(at.hit, button);
            const face = button.querySelector<HTMLElement>(".ui-text-button-face")!;
            box({ ...at.button, x: at.button.x - at.hit.x, y: at.button.y - at.hit.y }, face);
            buttons.set(control, button);
          },
        },
      });
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.control = control;
    button.className = "start-icon-button ui-press";
    button.setAttribute("aria-label", words[control]);
    box(at.hit, button);
    const face = document.createElement("span");
    face.className = "start-icon-face";
    box({ ...at.art, x: at.art.x - at.hit.x, y: at.art.y - at.hit.y }, face);
    const icon = image(control, {
      height: 0,
      width: 0,
      x: at.icon.x - at.art.x,
      y: at.icon.y - at.art.y,
    });
    writeLayoutProperties(startIconProperties(at.pressedIcon.y - at.icon.y, at.hit), button);
    buttons.set(control, button);
    children.push({
      component: "Native",
      key: control,
      kind: "component",
      props: { element: button },
      slots: {
        content: [
          {
            component: "Native",
            key: "face",
            kind: "component",
            props: { element: face },
            slots: {
              content: [
                { component: "Native", key: "icon", kind: "component", props: { element: icon } },
              ],
            },
          },
        ],
      },
    });
  }
  mountUiLayout(document, document.createElement("div"), {
    component: "Native",
    key: "start",
    kind: "component",
    props: { element: root },
    slots: {
      content: [
        {
          component: "Native",
          key: "view",
          kind: "component",
          props: { element: view },
          slots: { content: children },
        },
      ],
    },
  });
  const orderedButtons = new Map<StartControl, HTMLButtonElement>();
  for (const control of order) {
    const button = buttons.get(control);
    if (button !== undefined) {
      orderedButtons.set(control, button);
    }
  }
  return { buttons: orderedButtons, images, root };
}
