import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { CARD_CONTENT, PLAY_MARK } from "../../data/layout.ts";
import { CARD_FRAME } from "../layout/cardFrame.ts";
import { CELEBRATION } from "../layout/celebrationCard.ts";
import { FONT_METRICS } from "../layout/fontRoles.ts";
import { setTextButtonSizing } from "./buttonLayout.ts";
import type { CardView } from "./card.ts";
import { mountUiLayout } from "./layoutTree.ts";

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

// The authored press area and face for one placeholder action.
export function celebrationButtonLayout(key: CelebrationControl): LayoutValues {
  const { button, hit } = CELEBRATION[key];
  return {
    "--celebration-button-height": button.height,
    "--celebration-button-width": button.width,
    "--celebration-hit-height": hit.height,
    "--celebration-hit-width": hit.width,
    "--celebration-hit-x": hit.x - CELEBRATION.card.x,
    "--celebration-hit-y": hit.y - CELEBRATION.card.y,
    "--celebration-inset-x": button.x - hit.x,
    "--celebration-inset-y": button.y - hit.y,
  };
}

// Preserve the placeholder's authored frame, text slots and button press areas.
export const CELEBRATION_DOM_LAYOUT: LayoutValues = {
  ...celebrationButtonLayout("continue"),
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
  const image = (key: "normal" | "pressed" | "mark") => {
    const element = document.createElement("img");
    element.alt = "";
    element.draggable = false;
    element.className = `celebration-${key}`;
    return element;
  };
  const images = { mark: image("mark"), normal: image("normal"), pressed: image("pressed") };
  let card!: CardView<CelebrationControl>;
  mountUiLayout(document, document.createElement("div"), {
    component: "Card",
    key: "celebration",
    kind: "component",
    props: {
      id: "celebration",
      ref: (view) => {
        card = {
          ...view,
          buttons: { continue: view.buttons.continue!, restart: view.buttons.restart! },
        };
        card.root.classList.add("celebration-scene");
        card.dialog.classList.add("celebration-card");
        card.dialog.setAttribute("role", "region");
        writeLayoutProperties(CELEBRATION_DOM_LAYOUT, card.root);
        for (const key of ["continue", "restart"] as const) {
          const control = card.buttons[key];
          setTextButtonSizing("authored", control);
          control.dataset.action = key;
          writeLayoutProperties(celebrationButtonLayout(key), control);
        }
        const face = card.buttons.continue.querySelector(".ui-text-button-face")!;
        face.classList.remove("ui-frame");
        face.prepend(images.normal, images.pressed);
        card.buttons.continue.querySelector(".ui-text-button-label")!.prepend(images.mark);
      },
      words: {
        actions: [
          { key: "continue", label: words.continue },
          { key: "restart", label: words.restart },
        ],
        text: words.message,
        title: words.title,
      },
    },
  });
  return { ...card, images };
}
