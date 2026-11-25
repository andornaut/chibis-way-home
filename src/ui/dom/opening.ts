import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { CARD_CONTENT, PLAY_MARK, TEXT_BUTTON } from "../../data/layout.ts";
import { mountUiLayout, type UiLayoutNode } from "./layoutTree.ts";

export type OpeningAction = "continue" | "skip";

export const OPENING_PROPERTIES: LayoutValues = {
  "--opening-footer-height": TEXT_BUTTON.height + 2 * CARD_CONTENT.padding,
  "--opening-mark-gap": PLAY_MARK.gap,
  "--opening-mark-height": PLAY_MARK.height,
  "--opening-mark-width": PLAY_MARK.width,
};

export interface OpeningView {
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

// Native text determines both equal-width faces. Continue leads the focus order, with Skip left.
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
  let caption!: HTMLElement;
  const buttons = new Map<OpeningAction, HTMLButtonElement>();
  const mark = document.createElement("img");
  mark.alt = "";
  const actions = document.createElement("div");
  actions.className = "ui-card-actions opening-actions";
  const tree: UiLayoutNode = {
    component: "Native",
    key: "opening",
    kind: "component",
    props: { element: root },
    slots: {
      content: [
        { component: "Native", key: "backdrop", kind: "component", props: { element: backdrop } },
        {
          component: "Native",
          key: "view",
          kind: "component",
          props: { element: view },
          slots: {
            content: [
              {
                component: "Native",
                key: "footer",
                kind: "component",
                props: { element: footer },
                slots: {
                  content: [
                    {
                      component: "Text",
                      key: "caption",
                      kind: "component",
                      props: {
                        attributes: { "aria-live": "polite" },
                        className: "opening-caption ui-text-body",
                        ref: (element) => {
                          caption = element;
                        },
                        tag: "p",
                        text: "",
                      },
                    },
                    {
                      component: "Native",
                      key: "actions",
                      kind: "component",
                      props: { element: actions },
                      slots: {
                        content: (["continue", "skip"] as const).map((action) => ({
                          component: "Button",
                          key: action,
                          kind: "component",
                          props: {
                            control: action,
                            label: words[action],
                            primary: action === "continue",
                            ref: (button) => {
                              buttons.set(action, button);
                              if (action === "continue") {
                                button.querySelector(".ui-text-button-label")!.prepend(mark);
                              }
                            },
                          },
                        })),
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
  mountUiLayout(document, document.createElement("div"), tree);
  return {
    buttons: { continue: buttons.get("continue")!, skip: buttons.get("skip")! },
    caption,
    mark,
    root,
  };
}

export function showOpeningCaption(text: string, view: OpeningView): void {
  view.caption.textContent = text;
}
