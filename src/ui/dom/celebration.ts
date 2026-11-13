import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { CARD_CONTENT, PLAY_MARK } from "../../data/layout.ts";
import { CARD_FRAME } from "../layout/cardFrame.ts";
import { FONT_METRICS } from "../layout/fontRoles.ts";
import { CELEBRATION } from "../layout/restartCard.ts";
import { type CardView, createCard } from "./card.ts";

export type CelebrationControl = "continue" | "restart";
export interface CelebrationWords {
  readonly continue: string;
  readonly message: string;
  readonly restart: string;
  readonly title: string;
}
export interface CelebrationView extends CardView<CelebrationControl> {
  readonly images: Readonly<Record<"normal" | "pressed" | "mark", HTMLImageElement>>;
}

// Preserve the placeholder's authored frame, text slots and button press areas.
export const CELEBRATION_DOM_LAYOUT: LayoutValues = {
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
  const card = createCard<CelebrationControl>(document, "celebration", {
    actions: [
      { key: "continue", label: words.continue },
      { key: "restart", label: words.restart },
    ],
    text: words.message,
    title: words.title,
  });
  card.root.classList.add("celebration-scene");
  card.dialog.classList.add("celebration-card");
  card.dialog.setAttribute("role", "region");
  writeLayoutProperties(CELEBRATION_DOM_LAYOUT, card.root);
  for (const key of ["continue", "restart"] as const) {
    const { button, hit } = CELEBRATION[key];
    const control = card.buttons[key];
    control.dataset.action = key;
    writeLayoutProperties(
      {
        "--celebration-button-height": button.height,
        "--celebration-button-width": button.width,
        "--celebration-hit-height": hit.height,
        "--celebration-hit-width": hit.width,
        "--celebration-hit-x": hit.x - CELEBRATION.card.x,
        "--celebration-hit-y": hit.y - CELEBRATION.card.y,
        "--celebration-inset-x": button.x - hit.x,
        "--celebration-inset-y": button.y - hit.y,
      },
      control,
    );
  }
  const images = Object.fromEntries(
    ["normal", "pressed", "mark"].map((key) => {
      const image = document.createElement("img");
      image.alt = "";
      image.draggable = false;
      image.className = `celebration-${key}`;
      return [key, image];
    }),
  ) as Record<"normal" | "pressed" | "mark", HTMLImageElement>;
  const face = card.buttons.continue.querySelector(".ui-text-button-face")!;
  face.classList.remove("ui-frame");
  face.prepend(images.normal, images.pressed);
  card.buttons.continue.querySelector(".ui-text-button-label")!.prepend(images.mark);
  return { ...card, images };
}
