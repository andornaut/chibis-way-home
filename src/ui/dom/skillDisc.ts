import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import { createChromeSvg } from "@andornaut/game-kit/web/ui/dom/vectorChrome";

import type { Rect } from "../../data/types";
import { skillChromeLayers } from "../chrome/skillChrome";
import { SKILL_BUTTON } from "../layout/skillHud";

// A skill's disc in the HTML UI (skillDisc.css): its circle as inline SVG from the skill chrome's
// layers in the button's square target, with the skill's glyph at its native size centred on it,
// named as one image.

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

// The disc for colours (0xrrggbb), selected or not, named name. The glyph's text alternative is
// empty, since the name covers the whole disc.
export function createSkillDisc(
  document: Document,
  colours: { readonly face: number; readonly ink: number },
  selected: boolean,
  name: string,
): SkillDiscView {
  const element = document.createElement("span");
  element.className = "ui-skill-disc";
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", name);
  writeLayoutProperties(SKILL_DISC_LAYOUT, element);
  const svg = createChromeSvg(
    document,
    { height: SKILL_BUTTON.target, width: SKILL_BUTTON.target },
    skillChromeLayers(colours, selected),
  );
  svg.classList.add("ui-skill-disc-chrome");
  const glyph = document.createElement("img");
  glyph.className = "ui-skill-disc-glyph";
  glyph.alt = "";
  element.append(svg, glyph);
  return { element, glyph };
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
