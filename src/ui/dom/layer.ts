import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";
import type { RenderFit } from "@andornaut/game-kit/view/renderScale";
import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import {
  createModalLayer,
  type ModalLayer,
  type ModalOptions,
} from "@andornaut/game-kit/web/ui/dom/modalLayer";
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
  "--button-stack-gap": TEXT_BUTTON.stackGap,
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

// The attribute on what the top modal dims.
export const UI_DIMMED = "data-ui-dimmed";

export interface UiLayer {
  readonly element: HTMLElement;
  // The one modal layer over the scenes' views. Opening a card also dims what it covers.
  readonly modals: ModalLayer;
  // Registers the dimmed image for the lit image source lit, both blob: URLs.
  dimImage(lit: string, dimmed: string): void;
  dispose(): void;
  // Places the view for the canvas's fit, the canvas's top-left offset in the layer in CSS px.
  fit(canvasAt: Point, fit: RenderFit): void;
  // Mounts view as order's layer, above lower orders, and returns its removal.
  mount(order: number, view: HTMLElement): () => void;
  // Sets the dimmed skin: the custom properties (applySkin's) set on what a modal dims.
  setDimmedSkin(properties: LayoutValues): void;
}

// What the card dialog in one of root's views dims: the views under it, but not a live element
// in one or the elements along the path to it, whose other children it dims instead. The kit's
// modal layer makes the same elements inert, besides any view over the card's.
function dimTargets(
  root: HTMLElement,
  dialog: HTMLElement,
  live: readonly HTMLElement[],
): Set<Element> {
  const views = [...root.children];
  const below = views.slice(
    0,
    Math.max(
      0,
      views.findIndex((view) => view.contains(dialog)),
    ),
  );
  const paths = new Set<Element>();
  for (const element of live) {
    for (let at: Element | null = element; at !== null && at !== root; at = at.parentElement) {
      paths.add(at);
    }
  }
  const targets = new Set<Element>();
  const visit = (elements: readonly Element[]) => {
    for (const element of elements) {
      if (!paths.has(element)) {
        targets.add(element);
      } else if (!live.includes(element as HTMLElement)) {
        visit([...element.children]);
      }
    }
  };
  visit(below);
  return targets;
}

// The dim under the top modal (src/ui/dom/ui.css): what it covers takes the dimmed skin's
// colours and frames and its images' dimmed sources, so the UI under a card dims as the canvas's
// world does, through the same palette ramp. SVG chrome reads the colours (chrome.ts).
function createDim(root: HTMLElement) {
  let skin: LayoutValues = {};
  const images = new Map<string, string>();
  const dimmed = new Set<Element>();
  // Shows an image's dimmed source while it is under the dim, and its lit one otherwise.
  const showImage = (image: HTMLImageElement) => {
    const lit = image.dataset.uiLitSrc ?? image.getAttribute("src") ?? "";
    const dim = images.get(lit);
    if (image.closest(`[${UI_DIMMED}]`) !== null && dim !== undefined) {
      image.dataset.uiLitSrc = lit;
      image.src = dim;
    } else if (image.dataset.uiLitSrc !== undefined) {
      delete image.dataset.uiLitSrc;
      image.src = lit;
    }
  };
  const showImages = (element: Element) => {
    if (element instanceof HTMLImageElement) {
      showImage(element);
    }
    element.querySelectorAll("img").forEach(showImage);
  };
  const set = (element: Element, on: boolean) => {
    const { style } = element as HTMLElement;
    element.toggleAttribute(UI_DIMMED, on);
    for (const [name, value] of Object.entries(skin)) {
      if (on) {
        style.setProperty(name, String(value));
      } else {
        style.removeProperty(name);
      }
    }
    showImages(element);
  };
  // An image given a lit source while it is under the dim shows the dimmed one.
  const observer = new MutationObserver((records) => {
    for (const { target } of records) {
      if (target instanceof HTMLImageElement && target.closest(`[${UI_DIMMED}]`) !== null) {
        const src = target.getAttribute("src") ?? "";
        if (images.has(src)) {
          delete target.dataset.uiLitSrc;
          showImage(target);
        }
      }
    }
  });
  observer.observe(root, { attributeFilter: ["src"], attributes: true, subtree: true });
  return {
    apply(targets: ReadonlySet<Element>) {
      for (const element of [...dimmed]) {
        if (!targets.has(element)) {
          dimmed.delete(element);
          set(element, false);
        }
      }
      for (const element of targets) {
        if (!dimmed.has(element)) {
          dimmed.add(element);
          set(element, true);
        }
      }
    },
    dispose() {
      observer.disconnect();
    },
    image(lit: string, dim: string) {
      images.set(lit, dim);
    },
    skin(properties: LayoutValues) {
      skin = properties;
      dimmed.forEach((element) => set(element, true));
    },
  };
}

// The kit's modal layer over root, which also dims what the top card covers.
function createDimmingModals(root: HTMLElement, dim: ReturnType<typeof createDim>): ModalLayer {
  const modals = createModalLayer(root);
  const stack: { readonly dialog: HTMLElement; readonly options: ModalOptions }[] = [];
  const update = () => {
    const top = stack.at(-1);
    dim.apply(top === undefined ? new Set() : dimTargets(root, top.dialog, top.options.live ?? []));
  };
  return {
    back: () => modals.back(),
    dispose() {
      stack.length = 0;
      update();
      modals.dispose();
    },
    open(options, dialog) {
      const close = modals.open(options, dialog);
      const entry = { dialog, options };
      stack.push(entry);
      update();
      return () => {
        close();
        const index = stack.indexOf(entry);
        if (index >= 0) {
          stack.splice(index, 1);
          update();
        }
      };
    },
  };
}

// The UI layer for document, with frameEdges (art's nine-slice edges, in base px) kept as whole
// CSS px. The caller appends its element to #game.
export function createUiLayer(frameEdges: readonly number[], document: Document): UiLayer {
  const element = document.createElement("div");
  element.className = "ui-layer";
  writeLayoutProperties(UI_LAYOUT, element);
  const edges = [...new Set([...frameEdges, ...WHOLE_LENGTHS])].sort((a, b) => a - b);
  const update = createViewUnits(edges, element);
  const dim = createDim(element);
  const modals = createDimmingModals(element, dim);
  return {
    dimImage: (lit, dimmed) => dim.image(lit, dimmed),
    dispose() {
      modals.dispose();
      dim.dispose();
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
    setDimmedSkin: (properties) => dim.skin(properties),
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
