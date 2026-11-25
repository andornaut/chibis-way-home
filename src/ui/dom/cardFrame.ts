import { HIT_RULE } from "@andornaut/game-kit/runtime/ui/hitAreas";
import type { ModalFrameLayout } from "@andornaut/game-kit/runtime/ui/modalFrame";
import {
  createPressContext,
  type PressContext,
} from "@andornaut/game-kit/runtime/web/ui/dom/actionGroup";
import {
  createModalFrame,
  type DomModalFrameContext,
  type ModalFrameView,
} from "@andornaut/game-kit/runtime/web/ui/dom/modalFrame";
import { readUnit } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";

import { CARD_CONTENT, CARD_SCREEN_MARGIN, CARD_WIDTH, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Rect } from "../../data/types/index.ts";
import { createGameButton } from "../input/actionBinding.ts";
import type { CardWidth } from "../layout/contentCard.ts";
import { FONT_METRICS, UI_FONT_FACE } from "../layout/fontRoles.ts";
import { hitMargin } from "../layout/hitAreas.ts";
import { type ActionsContext, measuredActions } from "./actions.ts";
import { registerLayout, rendered } from "./layout.ts";

// A modal card in the HTML UI on the kit's modal frame (modalFrame.css): the frame's backdrop
// covers the whole layer, letterbox bars included, and takes the presses outside the card, and on
// the play view the card in
// art's ui-settings-card frame at its width family's width, centred, as tall as its content up
// to the view's height less the screen margin, past which its body scrolls. The card holds its
// title, its content, an optional pinned footer and an optional close X, which is last in the
// focus order. Every part is placed from the card's outer edge in whole base px. The card's press
// context clamps the press areas of the groups and rows added to it, and of its footer, toward
// each other.

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

// A one-line title's box: the heading's cap height, rounded up to a whole base px.
const TITLE_LINE = FONT_METRICS.mainHeading.size * UI_FONT_FACE.capHeight;

// A closeable card's body starts where its first press area clears the close X's press target by
// the gap: by default a text button's, which reaches the hit margin above its face.
const CLOSEABLE_BODY_OUTSET = hitMargin({
  height: TEXT_BUTTON.height,
  width: TEXT_BUTTON.height,
  x: 0,
  y: 0,
});

// The close X's press target ends this far below the card's top, the gap included.
const CLOSE_CLEAR =
  CLOSE.face.y + CLOSE.face.height / 2 + HIT_RULE.minTarget / 2 + CARD_CONTENT.gap;

// What the kit's frame places a card from: its context, its title's insets and how far the
// body's first press area reaches above the body.
export function cardFramePlacement(card: {
  // The rect the backdrop covers, in the play view's base px.
  readonly backdrop?: Rect;
  // How far the body's first press area reaches above it, on a closeable card.
  readonly bodyOutset?: number;
  readonly close: boolean;
  readonly content?: Rect;
  readonly family: CardWidth;
  // The title's measured height, where it is not one line.
  readonly titleHeight?: number;
  readonly titled: boolean;
}): {
  readonly bodyOutset?: number;
  readonly context: DomModalFrameContext;
  // A titled card's title insets.
  readonly title?: { readonly inkOffset?: number; readonly inset: number };
} {
  const bodyOutset = card.bodyOutset ?? CLOSEABLE_BODY_OUTSET;
  const height = card.titleHeight ?? Math.ceil(TITLE_LINE);
  // The header the close X's clearance sets, unless a taller title sets it. The title's ink is
  // centred between the frame's inner edge and the header's end, on the nearest whole pixel.
  const header = CLOSE_CLEAR + bodyOutset;
  const fits = card.close && height + 2 * TITLE_INSET < header;
  const top = Math.round((CARD_CONTENT.frameBorder + header - TITLE_LINE) / 2);
  return {
    ...(card.close ? { bodyOutset } : {}),
    context: {
      ...(card.backdrop === undefined ? {} : { backdrop: card.backdrop }),
      ...(card.close ? { close: CLOSE } : {}),
      content: card.content ?? VIEW,
      families: CARD_WIDTH,
      family: card.family,
      gap: CARD_CONTENT.gap,
      margin: CARD_SCREEN_MARGIN,
      padding: CARD_CONTENT.padding,
    },
    ...(card.titled
      ? {
          title: {
            inkOffset: fits ? top - Math.floor((header - height) / 2) : TITLE_INK_OFFSET,
            inset: TITLE_INSET,
          },
        }
      : {}),
  };
}

// The rect of the layer that holds view, in view's base px, each edge rounded outward to a whole
// unit: what a card's backdrop covers. Undefined outside a layer.
function layerCover(view: HTMLElement): Rect | undefined {
  const layer = view.closest<HTMLElement>(".ui-layer");
  if (layer === null) {
    return undefined;
  }
  const unit = readUnit(view);
  const outer = layer.getBoundingClientRect();
  const inner = view.getBoundingClientRect();
  const x = Math.floor((outer.left - inner.left) / unit + 1e-6);
  const y = Math.floor((outer.top - inner.top) / unit + 1e-6);
  return {
    height: Math.ceil((outer.bottom - inner.top) / unit - 1e-6) - y,
    width: Math.ceil((outer.right - inner.left) / unit - 1e-6) - x,
    x,
    y,
  };
}

export interface CardFrameOptions {
  // A card the player must answer rather than one they may browse past.
  readonly alert?: boolean;
  // The card's own class names.
  readonly className?: string;
  // How far the body's first press area reaches above it on a closeable card: a text button's
  // hit margin by default, and none for a body that starts with text or rows.
  readonly bodyOutset?: number;
  // The close X's accessible name, for a card with one.
  readonly close?: string;
  // The rect of the play view the card is centred in; the whole view by default.
  readonly content?: Rect;
  // Text the card is described by, as its content's first paragraph.
  readonly description?: string;
  readonly id: string;
  // The scene view's own class names.
  readonly sceneClassName?: string;
  // The card's title, which names it. A card without one starts its content at the top padding
  // and is named by label.
  readonly title?: string;
  // An untitled card's accessible name.
  readonly label?: string;
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
  // The press context of the card's neighbouring groups and rows; the footer is in it.
  readonly presses: PressContext;
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
    ...(options.title === undefined ? { label: options.label! } : { title: options.title }),
    titleClassName: "ui-card-title",
  });
  frame.content.classList.add("ui-card-content");
  frame.content.querySelector(".ui-modal-text")?.classList.add("ui-card-text");
  const root = document.createElement("div");
  root.className = ["ui-card-scene", options.sceneClassName].filter(Boolean).join(" ");
  const view = document.createElement("div");
  view.className = "ui-view";
  view.append(frame.element);
  root.append(view);
  const close = options.close === undefined ? undefined : closeButton(document, options.close);
  if (close !== undefined) {
    frame.card.append(close);
  }
  const presses = createPressContext(frame.card);
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
    const backdrop = layerCover(view);
    const placement = cardFramePlacement({
      ...(backdrop === undefined ? {} : { backdrop }),
      ...(options.bodyOutset === undefined ? {} : { bodyOutset: options.bodyOutset }),
      close: close !== undefined,
      ...(options.title === undefined
        ? {}
        : {
            titleHeight: Math.max(
              Math.ceil(TITLE_LINE),
              Math.ceil(frame.title.getBoundingClientRect().height / readUnit(frame.card) - 1e-6),
            ),
          }),
      ...(options.content === undefined ? {} : { content: options.content }),
      family,
      titled: options.title !== undefined,
    });
    const placed = frame.layout(placement.context, {
      ...(placement.bodyOutset === undefined ? {} : { bodyOutset: placement.bodyOutset }),
      ...(close === undefined ? {} : { close }),
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
      ...(placement.title === undefined ? {} : { title: placement.title }),
    }).frame;
    presses.apply();
    return placed;
  };
  registerLayout(layout, frame.card);
  return {
    backdrop: frame.backdrop,
    ...(close === undefined ? {} : { close }),
    content: frame.content,
    dialog: frame.card,
    frame,
    layout,
    presses,
    root,
    setFooter(actions, context) {
      frame.footer.element.append(...actions);
      presses.add(frame.footer);
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
