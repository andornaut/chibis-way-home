import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { CARD_CONTENT, PLAY_MARK } from "../../data/layout.ts";
import { CARD_FRAME } from "../layout/cardFrame.ts";
import { CELEBRATION } from "../layout/celebrationCard.ts";
import { FONT_METRICS } from "../layout/fontRoles.ts";
import { type CardView, createCard } from "./card.ts";

export type CelebrationControl = "continue" | "restart";
export interface CelebrationWords {
  readonly continue: string;
  readonly message: string;
  readonly restart: string;
  readonly title: string;
}
export interface CelebrationView extends CardView<CelebrationControl> {
  readonly mark: HTMLSpanElement;
}

// The authored frame and text slots, with a standard action row at the same top edge.
export const CELEBRATION_DOM_LAYOUT: LayoutValues = {
  "--celebration-actions-y": CELEBRATION.actionsY - CELEBRATION.card.y,
  "--celebration-card-height": CELEBRATION.card.height,
  "--celebration-card-width": CELEBRATION.card.width,
  "--celebration-card-x": CELEBRATION.card.x,
  "--celebration-card-y": CELEBRATION.card.y,
  "--celebration-mark-gap": PLAY_MARK.gap,
  "--celebration-mark-height": PLAY_MARK.height,
  "--celebration-mark-width": PLAY_MARK.width,
  "--celebration-message-width": CELEBRATION.room,
  "--celebration-message-x": CELEBRATION.message.x - CELEBRATION.card.x,
  "--celebration-message-y": CELEBRATION.message.y - CELEBRATION.card.y,
  "--celebration-title-line": CARD_CONTENT.lineHeight,
  "--celebration-title-size": FONT_METRICS.body.size,
  "--celebration-title-y": CARD_FRAME.titleY - CELEBRATION.card.y,
};

export function createCelebrationView(
  document: Document,
  words: CelebrationWords,
): CelebrationView {
  const card = createCard(document, "celebration", {
    actions: [
      { key: "continue", label: words.continue, primary: true },
      { key: "restart", label: words.restart },
    ],
    text: words.message,
    title: words.title,
    width: "small",
  });
  card.root.classList.add("celebration-scene");
  card.dialog.classList.add("celebration-card");
  card.dialog.setAttribute("role", "region");
  writeLayoutProperties(CELEBRATION_DOM_LAYOUT, card.root);
  card.buttons.continue.dataset.action = "continue";
  card.buttons.restart.dataset.action = "restart";

  const mark = document.createElement("span");
  mark.className = "celebration-mark";
  mark.setAttribute("aria-hidden", "true");
  card.buttons.continue.querySelector(".ui-text-button-label")!.prepend(mark);
  return { ...card, mark };
}
