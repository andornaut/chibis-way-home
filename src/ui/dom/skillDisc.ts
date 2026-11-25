import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import type { Rect } from "../../data/types/index.ts";
import { skillChromeLayers } from "../chrome/skillChrome.ts";
import { SKILL_BUTTON } from "../layout/skillHud.ts";
import { createPaletteSvg } from "./chrome.ts";

// A skill's disc in the HTML UI (skillDisc.css): its circle as inline SVG from the skill chrome's
// layers in the button's square target, with the skill's glyph at native size centred on it,
// named as one image. The skill HUD shows the same circle and glyph as a HUD disc's parts.

// The layout properties skillDisc.css reads, in base px.
export const SKILL_DISC_LAYOUT: LayoutValues = {
  "--skill-disc-glyph": SKILL_BUTTON.glyph,
  "--skill-disc-target": SKILL_BUTTON.target,
};

export interface SkillDiscView {
  readonly element: HTMLElement;
  // The glyph, whose source the caller sets.
  readonly glyph: HTMLImageElement;
}

// The palette colours the disc is drawn in, as 0xrrggbb.
export interface SkillDiscColours {
  readonly ink: number;
  readonly navy: number;
  readonly yellow: number;
}

// The base disc uses yellow for a ready skill and navy otherwise.
export interface SkillDiscLook {
  readonly ready: boolean;
}

// The view box that crops the chrome to its circle.
const DISC_MARGIN = (SKILL_BUTTON.target - SKILL_BUTTON.disc) / 2;
const DISC_VIEW_BOX = `${DISC_MARGIN} ${DISC_MARGIN} ${SKILL_BUTTON.disc} ${SKILL_BUTTON.disc}`;

function discSvg(document: Document, colours: SkillDiscColours, look: SkillDiscLook) {
  const { navy, yellow } = colours;
  const svg = createPaletteSvg(
    document,
    colours,
    { height: SKILL_BUTTON.target, width: SKILL_BUTTON.target },
    skillChromeLayers(look.ready ? yellow : navy),
  );
  svg.classList.add("ui-skill-disc-chrome");
  return svg;
}

// The disc for colours, looking as look, named name, or with no name of its own where the
// control it is in names it. The glyph's text alternative is empty, since a name covers the whole
// disc.
export function createSkillDisc(
  document: Document,
  colours: SkillDiscColours,
  look: SkillDiscLook,
  name: string | undefined,
): SkillDiscView {
  const element = document.createElement("span");
  element.className = "ui-skill-disc";
  if (name === undefined) {
    element.setAttribute("aria-hidden", "true");
  } else {
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", name);
  }
  writeLayoutProperties(SKILL_DISC_LAYOUT, element);
  const glyph = document.createElement("img");
  glyph.className = "ui-skill-disc-glyph";
  glyph.alt = "";
  element.append(discSvg(document, colours, look), glyph);
  return { element, glyph };
}

// A HUD disc's parts (the kit's hudDisc): the circle alone as the face's art, cropped to its
// drawn disc, and the glyph for the icon box. The button they are in names them.
export function createSkillDiscFace(
  document: Document,
  colours: SkillDiscColours,
  look: SkillDiscLook,
): SkillDiscView {
  const element = document.createElement("span");
  element.className = "ui-skill-disc-face";
  const chrome = discSvg(document, colours, look);
  chrome.setAttribute("viewBox", DISC_VIEW_BOX);
  const glyph = document.createElement("img");
  glyph.className = "ui-skill-disc-glyph";
  glyph.alt = "";
  element.append(chrome);
  return { element, glyph };
}

// Redraws view's circle for look, in the view box it has.
export function paintSkillDisc(
  colours: SkillDiscColours,
  look: SkillDiscLook,
  view: SkillDiscView,
): void {
  const shown = view.element.querySelector(".ui-skill-disc-chrome");
  if (shown === null) {
    return;
  }
  const chrome = discSvg(view.element.ownerDocument, colours, look);
  const viewBox = shown.getAttribute("viewBox");
  if (viewBox !== null) {
    chrome.setAttribute("viewBox", viewBox);
  }
  shown.replaceWith(chrome);
}

// rect of source filled with colour (a CSS colour) where it is opaque, keeping its alpha, as the
// canvas's fill tint draws a ready glyph, as a canvas the size of rect.
export function filledFrame(
  document: Document,
  source: CanvasImageSource,
  rect: Rect,
  colour: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("No 2D canvas to fill a sheet frame with");
  }
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = colour;
  context.fillRect(0, 0, rect.width, rect.height);
  return canvas;
}
