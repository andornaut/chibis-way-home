import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { SKILL_DETAILS } from "../../data/layout.ts";
import type { Rect } from "../../data/types/index.ts";
import { ROOM_SCREEN } from "../layout/roomScreen.ts";
import { SKILL_ROOM } from "../layout/skillDetails.ts";
import { type ActionHelpWords, createActionHelp } from "./actionHelp.ts";
import { textButton } from "./card.ts";
import {
  createDialoguePanel,
  DIALOGUE_PANEL_LAYOUT,
  type DialoguePanelView,
  type PanelParagraph,
  showPanelParagraph,
} from "./dialogue.ts";
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

// Text and controls only: the scene retains the room backdrop, cast and animation clock.
export function createRoomView(
  document: Document,
  colours: RoomViewColours,
  action: { readonly art: Rect; readonly hit: Rect },
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
  const properties: LayoutValues = {
    ...DIALOGUE_PANEL_LAYOUT,
    "--room-action-height": action.art.height,
    "--room-action-hit-height": action.hit.height,
    "--room-action-hit-width": action.hit.width,
    "--room-action-inset-x": action.art.x - action.hit.x,
    "--room-action-inset-y": action.art.y - action.hit.y,
    "--room-action-width": action.art.width,
    "--room-action-x": action.hit.x,
    "--room-action-y": action.hit.y,
    "--room-description-width": SKILL_DETAILS.descriptionWidth,
    "--room-gift-height": SKILL_ROOM.bounds.height,
    "--room-gift-top": SKILL_ROOM.bounds.y,
    "--room-name-x": ROOM_SCREEN.nameCentre.x,
    "--room-name-y": ROOM_SCREEN.nameCentre.y,
  };
  writeLayoutProperties(properties, root);
  const view = make("div", "ui-view room-view");
  const title = make("h1", words.gift === undefined ? "room-name" : "ui-card-title");
  title.id = "room-title";
  title.textContent = words.gift?.title ?? words.name;
  let panel: DialoguePanelView | undefined;
  let glyph: HTMLImageElement | undefined;
  if (words.gift === undefined) {
    view.append(title);
  } else {
    const gift = words.gift;
    panel = createDialoguePanel(document, "room-helper");
    showPanelParagraph(panel, gift.paragraph);
    const area = make("div", "room-gift-area");
    const card = make("section", "ui-card ui-frame room-gift-card");
    card.setAttribute("aria-labelledby", title.id);
    card.setAttribute("aria-describedby", "room-description");
    const body = make("div", "room-skill-body");
    const disc = createSkillDisc(document, colours, { ready: true, selected: false }, gift.disc);
    glyph = disc.glyph;
    const description = make("p", "room-description");
    description.id = "room-description";
    description.append(...createActionHelp(document, colours, words, gift.description));
    body.append(disc.element, description);
    card.append(title, body);
    area.append(card);
    view.append(panel.element, area);
  }
  const leave = textButton(document, words.action, words.gift !== undefined);
  leave.classList.add("room-leave");
  view.append(leave);
  root.append(view);
  return { glyph, leave, panel, root };
}
