import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";
import type { RenderFit } from "@andornaut/game-kit/view/renderScale";
import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import { createModalLayer, type ModalLayer } from "@andornaut/game-kit/web/ui/dom/modalLayer";
import { createViewUnits, slice } from "@andornaut/game-kit/web/ui/dom/viewUnits";

import { CARD_CONTENT, DEATH_CARD, FOCUS_RING, TEXT_BUTTON } from "../../data/layout";
import { SCREEN } from "../../data/screen";
import type { Point } from "../../data/types";
import { UI_FONT_FAMILY, UI_FONT_RESOURCES } from "../chrome/uiFonts";
import { cardTitleReserve } from "../layout/contentCard";
import { FONT_METRICS } from "../layout/fontRoles";
import { hitAround, hitMargin } from "../layout/hitAreas";
import { playView } from "../layout/playView";

// The HTML UI over the canvas (src/ui/dom/ui.css). The layer covers #game, so full-area
// backdrops reach the bars; each scene's view mounts in it as one child, stacked by the scene's
// place in the game's scene list (in document order, so later ones paint over earlier ones and
// read after them), and holds a .ui-view box on the play view. Every length in
// the UI's CSS is base pixels times --ui-unit, which this layer keeps current.

// The whole CSS px lengths the UI's CSS reads through slice(), besides art's frame edges: the
// focus ring's bands, a pressed label's sink, the card frame's border and the death card's
// statistics divider.
const RING_EDGES = [FOCUS_RING.inkLine, FOCUS_RING.outset - FOCUS_RING.inkLine, FOCUS_RING.outset];
const WHOLE_LENGTHS = [
  ...RING_EDGES,
  TEXT_BUTTON.pressedSink,
  CARD_CONTENT.frameBorder,
  DEATH_CARD.dividerWidth,
];

// A card's close X, drawn its inset in from the card's top and right edges, and its press area.
const CLOSE_ART = {
  height: CARD_CONTENT.closeSize,
  width: CARD_CONTENT.closeSize,
  x: CARD_CONTENT.closeInset,
  y: CARD_CONTENT.closeInset,
};
const CLOSE_HIT = hitAround(CLOSE_ART);

// The layout constants the UI's CSS reads, as unitless base px, or as whole-px lengths from the
// view bridge.
export const UI_LAYOUT: LayoutValues = {
  "--button-gap": CARD_CONTENT.gap,
  "--button-height": TEXT_BUTTON.height,
  // A text button's shorter side is its height, so its press area reaches this far past it.
  "--button-hit": hitMargin({ height: TEXT_BUTTON.height, width: TEXT_BUTTON.height, x: 0, y: 0 }),
  "--button-inset": TEXT_BUTTON.inset,
  "--button-lip": TEXT_BUTTON.lipHeight,
  "--button-sink": slice(TEXT_BUTTON.pressedSink),
  "--card-edge": slice(CARD_CONTENT.frameBorder),
  "--card-frame": CARD_CONTENT.frameBorder,
  "--card-gap": CARD_CONTENT.gap,
  "--card-min-width": SCREEN.width * MODAL_CONTENT.minWidthFraction,
  "--card-padding": CARD_CONTENT.padding,
  // How far below the card's top a card with a close X starts its body's press areas, the gap
  // past the X's press area.
  "--close-clear": CLOSE_HIT.y + CLOSE_HIT.height + CARD_CONTENT.gap,
  // How far the X's press area reaches past its drawn side.
  "--close-hit": CLOSE_ART.x - CLOSE_HIT.x,
  "--close-inset": CARD_CONTENT.closeInset,
  // A centred title's clearance from each side of a card with a close X.
  "--close-reserve": cardTitleReserve(true),
  "--close-size": CARD_CONTENT.closeSize,
  "--focus-band": slice(FOCUS_RING.outset - FOCUS_RING.inkLine),
  "--focus-ink": slice(FOCUS_RING.inkLine),
  "--focus-outset": slice(FOCUS_RING.outset),
  "--heading-line": FONT_METRICS.mainHeading.lineHeight,
  "--heading-size": FONT_METRICS.mainHeading.size,
  "--text-line": FONT_METRICS.body.lineHeight,
  "--text-size": FONT_METRICS.body.size,
};

export interface UiLayer {
  readonly element: HTMLElement;
  // The one modal layer over the scenes' views.
  readonly modals: ModalLayer;
  dispose(): void;
  // Places the view for the canvas's fit, the canvas's top-left offset in the layer in CSS px.
  fit(canvasAt: Point, fit: RenderFit): void;
  // Mounts view as order's layer, above lower orders, and returns its removal.
  mount(order: number, view: HTMLElement): () => void;
}

// The UI layer for document, with frameEdges (art's nine-slice edges, in base px) kept as whole
// CSS px. The caller appends its element to #game.
export function createUiLayer(frameEdges: readonly number[], document: Document): UiLayer {
  const element = document.createElement("div");
  element.className = "ui-layer";
  writeLayoutProperties(UI_LAYOUT, element);
  const edges = [...new Set([...frameEdges, ...WHOLE_LENGTHS])].sort((a, b) => a - b);
  const update = createViewUnits(edges, element);
  const modals = createModalLayer(element);
  return {
    dispose() {
      modals.dispose();
      element.remove();
    },
    element,
    fit(canvasAt, fit) {
      const view = playView(fit);
      update({
        unit: fit.fit,
        view: {
          height: view.height / fit.r,
          width: view.width / fit.r,
          x: canvasAt.x + view.x / fit.r,
          y: canvasAt.y + view.y / fit.r,
        },
      });
    },
    modals,
    mount(order, view) {
      view.classList.add("ui-scene");
      view.dataset.uiOrder = String(order);
      const after = [...element.children].find(
        (child) => Number((child as HTMLElement).dataset.uiOrder) > order,
      );
      element.insertBefore(view, after ?? null);
      return () => view.remove();
    },
  };
}

// Resolves once both UI font weights have loaded through ui.css's @font-face rules, or failed,
// so no DOM screen first shows in a fallback face. A failure leaves the fallback in place.
export function loadUiFonts(fonts: Pick<FontFaceSet, "load">): Promise<void> {
  return Promise.all(
    UI_FONT_RESOURCES.map(({ style, weight }) =>
      fonts.load(`${style} ${weight} ${FONT_METRICS.body.size}px "${UI_FONT_FAMILY}"`),
    ),
  ).then(
    () => undefined,
    (error: unknown) => console.warn("UI fonts failed to load", error),
  );
}
