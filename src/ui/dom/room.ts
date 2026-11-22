import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { SKILL_DETAILS } from "../../data/layout.ts";
import type { Rect } from "../../data/types/index.ts";
import { PAGE_TITLE } from "../layout/pageTitle.ts";
import { ROOM_SCREEN } from "../layout/roomScreen.ts";
import { SKILL_ROOM } from "../layout/skillDetails.ts";
import { type ActionHelpWords, createActionHelp } from "./actionHelp.ts";
import { setCardWidth } from "./card.ts";
import {
  createDialoguePanel,
  DIALOGUE_PANEL_LAYOUT,
  type DialoguePanelView,
  type PanelParagraph,
  showPanelParagraph,
} from "./dialogue.ts";
import { mountUiLayout, type UiLayoutNode } from "./layoutTree.ts";
import { createSkillDisc } from "./skillDisc.ts";

export interface RoomViewColours {
  readonly cream: number;
  readonly ink: number;
  readonly navy: number;
  readonly white: number;
  readonly yellow: number;
}

export interface RoomViewWords extends ActionHelpWords {
  readonly action: string;
  readonly name: string;
  readonly gift?: {
    readonly description: string;
    readonly disc: string;
    readonly paragraph: PanelParagraph;
    readonly title: string;
  };
}

export interface RoomView {
  readonly leave: HTMLButtonElement;
  readonly glyph: HTMLImageElement | undefined;
  readonly panel: DialoguePanelView | undefined;
  readonly root: HTMLElement;
}

export function roomPortraitProperties(size: Pick<Rect, "height" | "width">): LayoutValues {
  return { "--room-portrait-height": size.height, "--room-portrait-width": size.width };
}

export function roomProperties(): LayoutValues {
  return {
    ...DIALOGUE_PANEL_LAYOUT,
    "--room-description-width": SKILL_DETAILS.descriptionWidth,
    "--room-footer-width": SKILL_ROOM.footer.width,
    "--room-gift-height": SKILL_ROOM.bounds.height,
    "--room-gift-top": SKILL_ROOM.bounds.y,
    "--room-leave-right": ROOM_SCREEN.leave.rightInset,
    "--room-leave-y": ROOM_SCREEN.leave.y,
    "--room-name-x": PAGE_TITLE.x,
    "--room-name-y": PAGE_TITLE.y,
    "--room-title-width": PAGE_TITLE.width,
  };
}

// Text and controls only: the scene retains the room backdrop, cast and animation clock.
export function createRoomView(
  document: Document,
  colours: RoomViewColours,
  words: RoomViewWords,
): RoomView {
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const element = document.createElement(tag);
    element.className = className;
    return element;
  };
  const root = make("div", "room-scene");
  root.setAttribute("role", "region");
  root.setAttribute("aria-labelledby", "room-title");
  root.toggleAttribute("data-gift", words.gift !== undefined);
  writeLayoutProperties(roomProperties(), root);
  const view = make("div", "ui-view room-view");
  const title: UiLayoutNode = {
    component: "Text",
    key: "title",
    kind: "component",
    props: {
      className: words.gift === undefined ? "room-name" : "ui-card-title",
      id: "room-title",
      tag: "h1",
      text: words.gift?.title ?? words.name,
    },
  };
  const children: UiLayoutNode[] = [];
  let panel: DialoguePanelView | undefined;
  let glyph: HTMLImageElement | undefined;
  if (words.gift === undefined) {
    children.push(title);
  } else {
    const gift = words.gift;
    panel = createDialoguePanel(document, "room-helper");
    showPanelParagraph(panel, gift.paragraph);
    const area = make("div", "room-gift-area");
    const card = make("section", "ui-card ui-frame room-gift-card");
    // The skill details card's body.
    setCardWidth("large", card);
    card.setAttribute("aria-labelledby", "room-title");
    card.setAttribute("aria-describedby", "room-description");
    const body = make("div", "room-skill-body");
    const disc = createSkillDisc(document, colours, { ready: true }, gift.disc);
    glyph = disc.glyph;
    const description = make("p", "room-description");
    description.id = "room-description";
    description.append(...createActionHelp(document, colours, words, gift.description));
    children.push(
      { component: "Native", key: "helper", kind: "component", props: { element: panel.element } },
      {
        component: "Native",
        key: "gift-area",
        kind: "component",
        props: { element: area },
        slots: {
          content: [
            {
              component: "Native",
              key: "gift-card",
              kind: "component",
              props: { element: card },
              slots: {
                content: [
                  title,
                  {
                    component: "Native",
                    key: "body",
                    kind: "component",
                    props: { element: body },
                    slots: {
                      content: [
                        {
                          component: "Native",
                          key: "disc",
                          kind: "component",
                          props: { element: disc.element },
                        },
                        {
                          component: "Native",
                          key: "description",
                          kind: "component",
                          props: { element: description },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    );
  }
  let leave!: HTMLButtonElement;
  children.push({
    component: "Button",
    key: "leave",
    kind: "component",
    props: {
      label: words.action,
      primary: words.gift !== undefined,
      ref: (button) => {
        leave = button;
        button.classList.add("room-leave");
      },
      ...(words.gift !== undefined && { sizing: "authored" }),
    },
  });
  mountUiLayout(document, document.createElement("div"), {
    component: "Native",
    key: "room",
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
  return { glyph, leave, panel, root };
}
