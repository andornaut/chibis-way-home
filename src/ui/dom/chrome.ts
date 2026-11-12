import { type ChromeLayer, createChromeSvg } from "@andornaut/game-kit/web/ui/dom/vectorChrome";

import { UI_COLOURS, type UiColour } from "./skin";

// Vector chrome as inline SVG (the kit's createChromeSvg) whose shapes paint in the UI's palette
// colours: each shape names its colour in data-ui-fill or data-ui-stroke, which ui.css paints in
// --colour-<name>, so the chrome takes the dimmed skin under a modal as the rest of the UI does.
// The shape's own fill or stroke attribute stays as drawn.

// The palette colours chrome is drawn in, as 0xrrggbb, by name.
export type ChromeColours = Readonly<Partial<Record<UiColour, number>>>;

// The SVG of frame's size in base pixels with layers painted in order, each layer's colour one of
// colours'.
export function createPaletteSvg(
  document: Document,
  colours: ChromeColours,
  frame: { readonly height: number; readonly width: number },
  layers: readonly ChromeLayer[],
): SVGSVGElement {
  const svg = createChromeSvg(document, frame, layers);
  const shapes = [...svg.children];
  layers.forEach((layer, index) => {
    const name = UI_COLOURS.find((colour) => colours[colour] === layer.colour);
    if (name === undefined) {
      throw new Error(`No UI colour is 0x${layer.colour.toString(16).padStart(6, "0")}`);
    }
    const painted = layer.kind === "disc" || layer.kind === "rect" ? "fill" : "stroke";
    shapes[index]!.setAttribute(`data-ui-${painted}`, name);
  });
  return svg;
}
