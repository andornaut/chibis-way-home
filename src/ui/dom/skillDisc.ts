import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import type { Rect } from "../../data/types";
import { skillChromeLayers } from "../chrome/skillChrome";
import { SKILL_BUTTON } from "../layout/skillHud";
import { createPaletteSvg } from "./chrome";

// A skill's disc in the HTML UI (skillDisc.css): its circle as inline SVG from the skill chrome's
// layers in the button's square target, a yellow face while ready and a navy one otherwise, the
// selected skill's inside an ink annulus, with the skill's glyph at its native size centred on
// it, named as one image.

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

// How a disc shows: its face ready or not, and its skill selected or not.
export interface SkillDiscLook {
  readonly ready: boolean;
  readonly selected: boolean;
}

function discSvg(document: Document, colours: SkillDiscColours, look: SkillDiscLook) {
  const { ink, navy, yellow } = colours;
  const svg = createPaletteSvg(
    document,
    colours,
    { height: SKILL_BUTTON.target, width: SKILL_BUTTON.target },
    skillChromeLayers({ face: look.ready ? yellow : navy, ink }, look.selected),
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

// Redraws view's circle for look.
export function paintSkillDisc(
  colours: SkillDiscColours,
  look: SkillDiscLook,
  view: SkillDiscView,
): void {
  const document = view.element.ownerDocument;
  view.element
    .querySelector(".ui-skill-disc-chrome")
    ?.replaceWith(discSvg(document, colours, look));
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
