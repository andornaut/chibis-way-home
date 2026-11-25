import type { ModalFrameLayout } from "@andornaut/game-kit/runtime/ui/modalFrame";
import {
  createModalFrame,
  type ModalFrameView,
} from "@andornaut/game-kit/runtime/web/ui/dom/modalFrame";

import { CARD_CONTENT, CARD_SCREEN_MARGIN, CARD_WIDTH, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { createGameButton } from "../input/actionBinding.ts";
import type { CardWidth } from "../layout/contentCard.ts";
import { hitMargin } from "../layout/hitAreas.ts";
import { type ActionsContext, measuredActions } from "./actions.ts";
import { registerLayout, rendered } from "./layout.ts";

// A modal card in the HTML UI on the kit's modal frame (modalFrame.css): the scene's view holds a
// full-area backdrop that takes the presses outside the card, and on the play view the card in
// art's ui-settings-card frame at its width family's width, centred, as tall as its content up
// to the view's height less the screen margin, past which its body scrolls. The card holds its
// title, its content, an optional pinned footer and an optional close X, which is last in the
// focus order. Every part is placed from the card's outer edge in whole base px.

// The play view a card is centred in.
const VIEW = { height: SCREEN.height, width: SCREEN.width, x: 0, y: 0 } as const;

// The close X's face in from the card's top and right edges; its press target is the hit rule's.
const CLOSE = {
  face: {
    height: CARD_CONTENT.closeSize,
    width: CARD_CONTENT.closeSize,
    x: CARD_CONTENT.closeInset,
    y: CARD_CONTENT.closeInset,
  },
} as const;

// The title's ink sits as far below the frame's inner edge as the content sits below its ink:
// the title's box is centred in the header, then moved down by half the frame's edge. Beside a
// close X the header is taller than the title by an odd length, whose spare unit goes above.
const TITLE_INSET = CARD_CONTENT.padding - CARD_CONTENT.frameBorder / 2;
const TITLE_INK_OFFSET = CARD_CONTENT.frameBorder / 2;
const CLOSEABLE_TITLE_INK_OFFSET = TITLE_INK_OFFSET + 1;

// A closeable card's body starts where a press area reaching the hit margin above it clears the
// close X's press target by the gap.
const CLOSEABLE_BODY_OUTSET = hitMargin({
  height: TEXT_BUTTON.height,
  width: TEXT_BUTTON.height,
  x: 0,
  y: 0,
});

export interface CardFrameOptions {
  // A card the player must answer rather than one they may browse past.
  readonly alert?: boolean;
  // The card's own class names.
  readonly className?: string;
  // The close X's accessible name, for a card with one.
  readonly close?: string;
  // The rect of the play view the card is centred in; the whole view by default.
  readonly content?: Rect;
  // Text the card is described by, as its content's first paragraph.
  readonly description?: string;
  readonly id: string;
  // The scene view's own class names.
  readonly sceneClassName?: string;
  // A card without a title starts its content at the top padding.
  readonly title?: string;
  readonly width: CardWidth;
}

export interface CardFrame {
  readonly backdrop: HTMLElement;
  readonly close?: HTMLButtonElement;
  // The box the card's content is appended to.
  readonly content: HTMLElement;
  // The card itself: role dialog or alertdialog, named by its title.
  readonly dialog: HTMLElement;
  readonly frame: ModalFrameView;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
  readonly title: HTMLElement;
  // Measures and places the card; undefined while it is not rendered.
  layout(): ModalFrameLayout | undefined;
  // Pins actions, in their focus order, in the card's footer below its scrolling body.
  setFooter(
    actions: readonly HTMLElement[],
    context?: ActionsContext | (() => ActionsContext),
  ): void;
  setWidth(width: CardWidth): void;
}

// The close X: its box is its face, art's ui-close, and the frame gives it its press target. Its
// name is the accessible one; it shows no text.
export function closeButton(document: Document, name: string): HTMLButtonElement {
  return createGameButton(
    document,
    { className: "ui-close-button", face: { className: "ui-close-face" } },
    { kind: "icon", name },
  ).element;
}

export function createCardFrame(document: Document, options: CardFrameOptions): CardFrame {
  const frame = createModalFrame(document, {
    cardClassName: ["ui-card", options.className].filter(Boolean).join(" "),
    ...(options.description === undefined ? {} : { description: options.description }),
    id: options.id,
    role: options.alert === true ? "alertdialog" : "dialog",
    skinClassName: "ui-frame ui-card-skin",
    title: options.title ?? "",
    titleClassName: "ui-card-title",
  });
  frame.content.classList.add("ui-card-content");
  frame.content.querySelector(".ui-modal-text")?.classList.add("ui-card-text");
  if (options.title === undefined) {
    frame.title.hidden = true;
    frame.card.removeAttribute("aria-labelledby");
  }
  const root = document.createElement("div");
  root.className = ["ui-card-scene", options.sceneClassName].filter(Boolean).join(" ");
  const view = document.createElement("div");
  view.className = "ui-view";
  view.append(frame.element);
  // The backdrop covers the whole layer, past the play view the frame is placed in.
  frame.backdrop.classList.add("ui-backdrop");
  root.append(frame.backdrop, view);
  const close = options.close === undefined ? undefined : closeButton(document, options.close);
  if (close !== undefined) {
    frame.card.append(close);
  }
  let family = options.width;
  let footer:
    | {
        readonly actions: readonly HTMLElement[];
        readonly context?: ActionsContext | (() => ActionsContext);
      }
    | undefined;
  const layout = () => {
    if (!rendered(frame.element)) {
      return undefined;
    }
    const titled = options.title !== undefined;
    return frame.layout(
      {
        ...(close === undefined ? {} : { close: CLOSE }),
        content: options.content ?? VIEW,
        families: CARD_WIDTH,
        family,
        gap: CARD_CONTENT.gap,
        margin: CARD_SCREEN_MARGIN,
        padding: CARD_CONTENT.padding,
      },
      {
        ...(close === undefined ? {} : { bodyOutset: CLOSEABLE_BODY_OUTSET, close }),
        ...(footer === undefined
          ? {}
          : {
              footer: {
                actions: measuredActions(frame.footer, footer.actions),
                ...(footer.context === undefined
                  ? {}
                  : {
                      context:
                        typeof footer.context === "function" ? footer.context() : footer.context,
                    }),
              },
            }),
        title: titled
          ? {
              inkOffset: close === undefined ? TITLE_INK_OFFSET : CLOSEABLE_TITLE_INK_OFFSET,
              inset: TITLE_INSET,
            }
          : { inset: CARD_CONTENT.padding / 2 },
      },
    ).frame;
  };
  registerLayout(layout, frame.card);
  return {
    backdrop: frame.backdrop,
    ...(close === undefined ? {} : { close }),
    content: frame.content,
    dialog: frame.card,
    frame,
    layout,
    root,
    setFooter(actions, context) {
      frame.footer.element.append(...actions);
      // The footer shows from now on, so its actions have boxes to measure.
      frame.card.setAttribute("data-ui-modal-footer", "");
      footer = { actions, ...(context === undefined ? {} : { context }) };
      layout();
    },
    setWidth(width) {
      family = width;
      layout();
    },
    title: frame.title,
  };
}
