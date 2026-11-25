import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { CARD_SCREEN_MARGIN, SKILL_DETAILS } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { PAGE_TITLE } from "../layout/pageTitle.ts";
import { ROOM_SCREEN } from "../layout/roomScreen.ts";
import { SKILL_ROOM } from "../layout/skillDetails.ts";
import { type ActionHelpWords, createActionHelp } from "./actionHelp.ts";
import { createActions } from "./actions.ts";
import { createCardFrame, textButton } from "./card.ts";
import {
  createDialoguePanel,
  DIALOGUE_PANEL_LAYOUT,
  type DialoguePanelView,
  type PanelParagraph,
  showPanelParagraph,
} from "./dialogue.ts";
import { createSkillDisc } from "./skillDisc.ts";

// A room's text and controls in the HTML UI (room.css, on ui.css). An ordinary room shows its
// name as the page title and a sole secondary Leave at the top right. A gift room shows the
// helper's dialogue panel, the skill's card between the panel and the footer, and a sole primary
// action centred in the footer. Each action sits in its own kit action group.

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

// The rect a gift card is centred in: the area between the panel and the footer, with the card
// frame's screen margin added above and below, so the card may be as tall as the area.
export const ROOM_GIFT_CONTENT: Rect = {
  height: SKILL_ROOM.bounds.height + 2 * CARD_SCREEN_MARGIN,
  width: SCREEN.width,
  x: 0,
  y: SKILL_ROOM.bounds.y - CARD_SCREEN_MARGIN,
};

export function roomPortraitProperties(size: Pick<Rect, "height" | "width">): LayoutValues {
  return { "--room-portrait-height": size.height, "--room-portrait-width": size.width };
}

export function roomProperties(): LayoutValues {
  return {
    ...DIALOGUE_PANEL_LAYOUT,
    "--room-description-width": SKILL_DETAILS.descriptionWidth,
    "--room-gift-shift": 0,
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
  const leave = textButton(document, words.action, words.gift !== undefined);
  if (words.gift === undefined) {
    const title = make("h1", "room-name ui-text-heading");
    title.id = "room-title";
    title.textContent = words.name;
    view.append(
      title,
      createActions(document, [leave], { className: "room-leave", width: "content" }).element,
    );
    root.append(view);
    return { glyph: undefined, leave, panel: undefined, root };
  }
  const gift = words.gift;
  const panel = createDialoguePanel(document, "room-helper");
  showPanelParagraph(panel, gift.paragraph);
  // The skill details card's body, in the same width family. The card frame takes the rect it
  // centres the card in as content.
  const options = {
    className: "room-gift-card",
    content: ROOM_GIFT_CONTENT,
    id: "room",
    title: gift.title,
    width: "large",
  } as const;
  const frame = createCardFrame(document, options);
  // The card is part of the room, not a modal: it takes no presses outside itself.
  frame.backdrop.hidden = true;
  frame.dialog.setAttribute("role", "region");
  frame.dialog.setAttribute("aria-describedby", "room-description");
  const body = make("div", "room-skill-body");
  const disc = createSkillDisc(document, colours, { ready: true }, gift.disc);
  const description = make("p", "room-description ui-text-body");
  description.id = "room-description";
  description.append(...createActionHelp(document, colours, words, gift.description));
  body.append(disc.element, description);
  frame.content.append(body);
  const footer = make("div", "room-footer");
  footer.append(createActions(document, [leave]).element);
  view.append(panel.element, footer);
  root.append(frame.root, view);
  return { glyph: disc.glyph, leave, panel, root };
}
