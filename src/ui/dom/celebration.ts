import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { PLAY_MARK } from "../../data/layout.ts";
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

// The celebration card in the HTML UI (celebration.css, on card.ts): its title, its message, one
// centred line, and Continue, art's green face with the play mark, beside Restart. Only the
// decorative play mark has Celebration-specific geometry.
export const CELEBRATION_DOM_LAYOUT: LayoutValues = {
  "--celebration-mark-gap": PLAY_MARK.gap,
  "--celebration-mark-height": PLAY_MARK.height,
  "--celebration-mark-width": PLAY_MARK.width,
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
