import type { RenderFit } from "@andornaut/game-kit/runtime/view/renderScale";
import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";
import {
  createModalLayer,
  type ModalLayer,
} from "@andornaut/game-kit/runtime/web/ui/dom/modalLayer";
import { createViewUnits, slice } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";

import { CARD_CONTENT, DEATH_CARD, TEXT_BUTTON } from "../../data/layout.ts";
import type { Point } from "../../data/types/index.ts";
import { disposeGameButtons, foregroundInput, foregroundPolicy } from "../binding/index.ts";
import { registerUiFonts, UI_FONT_FAMILY, UI_FONT_RESOURCES } from "../chrome/uiFonts.ts";
import { FONT_METRICS, hitMargin, playView } from "../layout/index.ts";
import {
  refreshTextButtonFrames,
  setButtonLayoutDefaults,
  watchTextButtonFrames,
} from "./buttonLayout.ts";
import { layoutWithin, watchLayouts } from "./layout.ts";
import { setThemeText } from "./theme.ts";

// The HTML UI over the canvas (src/ui/dom/ui.css). The layer covers #game, so full-area
// backdrops reach the bars; each scene's view mounts in it as one child, stacked by the scene's
// place in the game's scene list (in document order, so later ones paint over earlier ones and
// read after them), and holds a .ui-view box on the play view. Every length in
// the UI's CSS is base pixels times --ui-unit, which this layer keeps current.

// Whole CSS pixel lengths apart from the view art frame edges.
const WHOLE_LENGTHS = [TEXT_BUTTON.pressedSink, CARD_CONTENT.frameBorder, DEATH_CARD.dividerWidth];

// The UI font family and layout constants: unitless base px or whole-px lengths from the view
// bridge.
export const UI_LAYOUT: LayoutValues = {
  "--button-height": TEXT_BUTTON.height,
  // A text button's shorter side is its height, so its press area reaches this far past it.
  "--button-hit": hitMargin({ height: TEXT_BUTTON.height, width: TEXT_BUTTON.height, x: 0, y: 0 }),
  "--button-inset": TEXT_BUTTON.inset,
  "--button-lip": TEXT_BUTTON.lipHeight,
  "--button-sink": slice(TEXT_BUTTON.pressedSink),
  "--card-frame": CARD_CONTENT.frameBorder,
  "--card-gap": CARD_CONTENT.gap,
  "--card-padding": CARD_CONTENT.padding,
  "--close-size": CARD_CONTENT.closeSize,
  "--heading-line": FONT_METRICS.mainHeading.lineHeight,
  "--heading-size": FONT_METRICS.mainHeading.size,
  "--text-line": FONT_METRICS.body.lineHeight,
  "--text-size": FONT_METRICS.body.size,
  "--ui-font-family": JSON.stringify(UI_FONT_FAMILY),
  "--ui-page-divider-thickness": DEATH_CARD.dividerWidth,
};

// The attribute on what the top modal dims.
export const UI_DIMMED = "data-ui-dimmed";
// The marker on independently drawn UI chrome.
export const UI_COVERED = "data-ui-covered";

export interface UiLayer {
  readonly element: HTMLElement;
  // The one modal layer over the scenes' views. Opening a card also dims what it covers.
  readonly modals: ModalLayer;
  // Registers the dimmed image for the lit image source lit, both blob: URLs.
  dimImage(lit: string, dimmed: string): void;
  dispose(): void;
  // Places the view for the canvas's fit, the canvas's top-left offset in the layer in CSS px.
  fit(canvasAt: Point, fit: RenderFit): void;
  // Mounts the global menu entry, over every scene view, and returns its removal.
  menuEntry(entry: HTMLElement): () => void;
  // Mounts view as order's layer, above lower orders, and returns its removal.
  mount(order: number, view: HTMLElement): () => void;
  // Sets the dimmed skin: the custom properties (applySkin's) set on what a modal dims.
  setDimmedSkin(properties: LayoutValues): void;
}

// Paint follows the shared input layer's actual coverage, including siblings in one scene.
// Existing inert attributes remain owned by that layer or their original caller.
function dimTargets(root: HTMLElement, dialog: HTMLElement): Set<Element> {
  return new Set(
    [...root.querySelectorAll("[inert]")].filter(
      (element) =>
        !element.contains(dialog) &&
        !dialog.contains(element) &&
        element.parentElement?.closest("[inert]") === null,
    ),
  );
}

// Modal paint changes stacking only. Scene nodes retain their DOM order and layout.
function createModalPaint(root: HTMLElement, globalEntry: HTMLElement) {
  const owned = new Map<
    HTMLElement,
    { readonly before: string; readonly priority: string; value: string }
  >();
  const apply = (values: ReadonlyMap<HTMLElement, number>) => {
    for (const [element, state] of owned) {
      if (!values.has(element)) {
        if (
          element.style.zIndex === state.value &&
          element.style.getPropertyPriority("z-index") === ""
        ) {
          element.style.setProperty("z-index", state.before, state.priority);
        }
        owned.delete(element);
      }
    }
    for (const [element, value] of values) {
      const text = String(value);
      const state = owned.get(element) ?? {
        before: element.style.zIndex,
        priority: element.style.getPropertyPriority("z-index"),
        value: text,
      };
      state.value = text;
      owned.set(element, state);
      element.style.setProperty("z-index", text);
    }
  };
  return {
    show(dialogs: readonly HTMLElement[]) {
      const values = new Map<HTMLElement, number>();
      const views = [...root.children] as HTMLElement[];
      const modalViews = dialogs
        .map((dialog) => views.find((view) => view.contains(dialog)))
        .filter((view): view is HTMLElement => view !== undefined)
        .filter((view, index, all) => all.lastIndexOf(view) === index);
      if (dialogs.length > 0) {
        const below = views.filter((view) => view !== globalEntry && !modalViews.includes(view));
        below.sort((left, right) => Number(left.dataset.uiOrder) - Number(right.dataset.uiOrder));
        [...below, globalEntry, ...modalViews].forEach((view, index) => values.set(view, index));
        let child = dialogs.at(-1)!;
        const scene = views.find((view) => view.contains(child));
        while (child !== scene && child.parentElement !== null && root.contains(child)) {
          const siblings = [...child.parentElement.children] as HTMLElement[];
          [...siblings.filter((sibling) => sibling !== child), child].forEach((sibling, index) =>
            values.set(sibling, index),
          );
          child = child.parentElement;
        }
      }
      apply(values);
    },
  };
}

// The dim under the top modal (src/ui/dom/ui.css): what it covers takes the dimmed skin's
// colours and frames and its images' dimmed sources, so the UI under a card dims as the canvas's
// world does, through the same palette ramp. SVG chrome reads the colours (chrome.ts).
function createDim(root: HTMLElement) {
  let skin: LayoutValues = {};
  const images = new Map<string, string>();
  const dimmed = new Set<Element>();
  const saved = new Map<
    Element,
    Map<string, { readonly before: string; readonly priority: string; value: string }>
  >();
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
    if (on) {
      const properties = saved.get(element) ?? new Map();
      for (const [name, value] of Object.entries(skin)) {
        const state = properties.get(name) ?? {
          before: style.getPropertyValue(name),
          priority: style.getPropertyPriority(name),
          value: String(value),
        };
        state.value = String(value);
        properties.set(name, state);
        style.setProperty(name, state.value);
      }
      saved.set(element, properties);
    } else {
      for (const [name, state] of saved.get(element) ?? []) {
        if (
          style.getPropertyValue(name) === state.value &&
          style.getPropertyPriority(name) === ""
        ) {
          style.setProperty(name, state.before, state.priority);
        }
      }
      saved.delete(element);
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
function createDimmingModals(
  root: HTMLElement,
  dim: ReturnType<typeof createDim>,
  globalEntry: HTMLElement,
) {
  const modals = createModalLayer(
    root,
    root.ownerDocument.defaultView === null ? undefined : foregroundInput(root.ownerDocument),
  );
  const stack: { readonly dialog: HTMLElement }[] = [];
  const paint = createModalPaint(root, globalEntry);
  const update = () => {
    const top = stack.at(-1);
    paint.show(stack.map(({ dialog }) => dialog));
    dim.apply(top === undefined ? new Set() : dimTargets(root, top.dialog));
  };
  // P remains the game's existing modal close key; the shared owner handles Escape.
  const legacyPauseKey = (event: KeyboardEvent) => {
    if (
      !["p", "P"].includes(event.key) ||
      event.isComposing ||
      event.keyCode === 229 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      (event.target instanceof Element &&
        event.target.closest("input,textarea,select,[contenteditable],[role=textbox],dialog[open]"))
    ) {
      return;
    }
    const top = stack.at(-1);
    if (top === undefined) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat && foregroundPolicy(top.dialog).guard?.gate.accepts() !== false) {
      modals.back();
    }
  };
  root.addEventListener("keydown", legacyPauseKey);
  const observer = new MutationObserver(update);
  observer.observe(root, { attributeFilter: ["inert"], attributes: true, subtree: true });
  const layer: ModalLayer = {
    back: () => modals.back(),
    dispose() {
      root.removeEventListener("keydown", legacyPauseKey);
      observer.disconnect();
      stack.length = 0;
      update();
      modals.dispose();
    },
    open(options, dialog) {
      const close = modals.open(
        {
          ...options,
          foreground: {
            ...foregroundPolicy(dialog),
            ...options.foreground,
          },
          isolation: "dialog",
          live: [],
        },
        dialog,
      );
      const entry = { dialog };
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
  return { modals: layer, refresh: update };
}

// The UI layer for document, with frameEdges (art's nine-slice edges, in base px) kept as whole
// CSS px. The caller appends its element to #game.
export function createUiLayer(frameEdges: readonly number[], document: Document): UiLayer {
  registerUiFonts(document);
  const element = document.createElement("div");
  element.className = "ui-layer";
  writeLayoutProperties(UI_LAYOUT, element);
  setThemeText(element);
  setButtonLayoutDefaults(element);
  const stopButtonFrames = watchTextButtonFrames(element);
  const stopLayouts = watchLayouts(element);
  const edges = [...new Set([...frameEdges, ...WHOLE_LENGTHS])].sort((a, b) => a - b);
  const update = createViewUnits(edges, element);
  const dim = createDim(element);
  const globalEntry = document.createElement("div");
  globalEntry.className = "ui-scene global-menu-layer";
  globalEntry.dataset.uiOrder = String(Infinity);
  const entryView = document.createElement("div");
  entryView.className = "ui-view pause-hud-view";
  globalEntry.append(entryView);
  element.append(globalEntry);
  const { modals, refresh } = createDimmingModals(element, dim, globalEntry);
  return {
    dimImage: (lit, dimmed) => dim.image(lit, dimmed),
    dispose() {
      stopButtonFrames();
      stopLayouts();
      modals.dispose();
      dim.dispose();
      disposeGameButtons(element);
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
      refreshTextButtonFrames(element);
      layoutWithin(element);
    },
    menuEntry(entry) {
      if (entryView.childElementCount !== 0) {
        throw new Error("The global menu entry is already registered");
      }
      entryView.append(entry);
      return () => {
        disposeGameButtons(entry);
        entry.remove();
      };
    },
    modals,
    mount(order, view) {
      view.classList.add("ui-scene");
      view.dataset.uiOrder = String(order);
      const after = [...element.children].find(
        (child) => child !== globalEntry && Number((child as HTMLElement).dataset.uiOrder) > order,
      );
      element.insertBefore(view, after ?? globalEntry);
      refresh();
      return () => {
        disposeGameButtons(view);
        view.remove();
        refresh();
      };
    },
    setDimmedSkin: (properties) => dim.skin(properties),
  };
}

// Resolves once both registered UI font weights have loaded or failed,
// so no DOM screen first shows in a fallback face. A failure leaves the fallback in place.
export function loadUiFonts(fonts: Pick<FontFaceSet, "load">): Promise<void> {
  let warned = false;
  return Promise.all(
    UI_FONT_RESOURCES.map(({ style, weight }) =>
      fonts
        .load(`${style} ${weight} ${FONT_METRICS.body.size}px "${UI_FONT_FAMILY}"`)
        .catch((error: unknown) => {
          if (!warned) {
            warned = true;
            console.warn("UI fonts failed to load", error);
          }
        }),
    ),
  ).then(() => undefined);
}
