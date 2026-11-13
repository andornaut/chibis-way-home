import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import {
  cutFrame,
  setNineSlice,
  type SliceInsets,
} from "@andornaut/game-kit/web/ui/dom/sheetFrames";
import { slice } from "@andornaut/game-kit/web/ui/dom/viewUnits";

import type { Rect } from "../../data/types/index.ts";
import type { Palette } from "../chrome/dim.ts";
import { modalColour } from "../chrome/modalDim.ts";

// Art's nine-slice frames the HTML UI draws, cut from the images the game already loaded: each
// frame's art key, the animation tag whose first frame it is (the sheet's first frame where
// none) and the name its custom properties take. A whole frame has no nine-slice edges in art's
// manifest and is drawn whole, stretched to its box.
export interface UiFrame {
  readonly art: string;
  readonly name: string;
  readonly tag?: string;
  readonly whole?: true;
}

export const UI_FRAMES: readonly UiFrame[] = [
  { art: "ui-button", name: "ui-button", tag: "normal" },
  { art: "ui-button", name: "ui-button-disabled", tag: "disabled" },
  { art: "ui-button", name: "ui-button-pressed", tag: "pressed" },
  { art: "ui-button-primary", name: "ui-button-primary", tag: "normal" },
  { art: "ui-button-primary", name: "ui-button-primary-pressed", tag: "pressed" },
  { art: "ui-close", name: "ui-close", tag: "normal", whole: true },
  { art: "ui-close", name: "ui-close-pressed", tag: "pressed", whole: true },
  { art: "ui-dialogue-box", name: "ui-dialogue-box", whole: true },
  { art: "ui-icon-button", name: "ui-icon-button", tag: "normal", whole: true },
  { art: "ui-icon-button", name: "ui-icon-button-pressed", tag: "pressed", whole: true },
  { art: "ui-name-tab", name: "ui-name-tab-amber", tag: "amber" },
  { art: "ui-name-tab", name: "ui-name-tab-green", tag: "green" },
  { art: "ui-name-tab", name: "ui-name-tab-pink", tag: "pink" },
  { art: "ui-name-tab", name: "ui-name-tab-tan", tag: "tan" },
  { art: "ui-nav-bar", name: "ui-nav-bar" },
  { art: "ui-portrait-frame", name: "ui-portrait-frame", whole: true },
  { art: "ui-settings-card", name: "ui-settings-card" },
  { art: "ui-switch", name: "ui-switch-off", tag: "off", whole: true },
  { art: "ui-switch", name: "ui-switch-on", tag: "on", whole: true },
];

// The palette colours the HTML UI's CSS and its SVG chrome read, as --colour-<name>.
export const UI_COLOURS = [
  "amber",
  "cream",
  "dslate",
  "green",
  "grey",
  "ink",
  "lgrey",
  "navy",
  "pink",
  "red",
  "tan",
  "white",
  "yellow",
] as const;
export type UiColour = (typeof UI_COLOURS)[number];

export interface SkinFrame {
  readonly name: string;
  // The frame's rect in source, in source pixels.
  readonly rect: Rect;
  // Undefined for a whole frame.
  readonly slice?: SliceInsets;
  readonly source: CanvasImageSource;
}

// rect of source with each pixel's colour (0xrrggbb) replaced by remap's, keeping its alpha, as
// a canvas the size of rect. Each distinct colour is remapped once.
export function remappedFrame(
  document: Document,
  remap: (colour: number) => number,
  source: CanvasImageSource,
  rect: Rect,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("No 2D canvas to remap a sheet frame with");
  }
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  const image = context.getImageData(0, 0, rect.width, rect.height);
  const { data } = image;
  const remapped = new Map<number, number>();
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) {
      continue;
    }
    const colour = (data[index]! << 16) | (data[index + 1]! << 8) | data[index + 2]!;
    const to = remapped.get(colour) ?? remap(colour);
    remapped.set(colour, to);
    data[index] = (to >> 16) & 0xff;
    data[index + 1] = (to >> 8) & 0xff;
    data[index + 2] = to & 0xff;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

// A #rrggbb colour through remap.
function remappedHex(remap: (colour: number) => number, hex: string): string {
  return `#${remap(Number.parseInt(hex.slice(1), 16))
    .toString(16)
    .padStart(6, "0")}`;
}

// Each UI colour as --colour-<name>, from the palette, and under the modal dim: the palette's
// ramp remap the canvas's dim reads its capture through (modalColour).
export function skinColours(palette: Palette): {
  readonly dimmed: Readonly<Record<string, string>>;
  readonly lit: Readonly<Record<string, string>>;
} {
  const dim = modalColour(palette);
  const lit = UI_COLOURS.map((name) => {
    const colour = palette.colours[name];
    if (colour === undefined) {
      throw new Error(`The palette has no ${name}`);
    }
    return [`--colour-${name}`, colour] as const;
  });
  return {
    dimmed: Object.fromEntries(lit.map(([name, colour]) => [name, remappedHex(dim, colour)])),
    lit: Object.fromEntries(lit),
  };
}

// Sets each UI colour on layer as --colour-<name>, and each frame for .ui-frame: --<name>-image
// and --<name>-slice (sheetFrames), its border widths as whole CSS px in --<name>-border, and
// its edges as unitless base px in --<name>-top, -right, -bottom and -left. A whole frame sets
// only --<name>-image. Resolves with the dimmed skin: each colour and frame image under the
// modal dim, the palette's ramp remap the canvas's dim reads its capture through (modalColour),
// as the same custom properties, for the layer to set on what a modal dims.
export async function applySkin(
  document: Document,
  palette: Palette,
  frames: readonly SkinFrame[],
  layer: HTMLElement,
): Promise<LayoutValues> {
  const dim = modalColour(palette);
  const colours = skinColours(palette);
  writeLayoutProperties(colours.lit, layer);
  const cut = (canvas: HTMLCanvasElement) =>
    cutFrame(document, canvas, { height: canvas.height, width: canvas.width, x: 0, y: 0 });
  const urls = await Promise.all(
    frames.map(({ rect, source }) =>
      Promise.all([
        cutFrame(document, source, rect),
        cut(remappedFrame(document, dim, source, rect)),
      ]),
    ),
  );
  const dimmed: Record<string, string> = { ...colours.dimmed };
  frames.forEach(({ name, slice: insets }, index) => {
    const [url, dimmedUrl] = urls[index]!;
    dimmed[`--${name}-image`] = `url("${dimmedUrl}")`;
    if (insets === undefined) {
      writeLayoutProperties({ [`--${name}-image`]: `url("${url}")` }, layer);
      return;
    }
    const { bottom, left, right, top } = insets;
    setNineSlice(name, { slice: insets, url }, layer);
    writeLayoutProperties(
      {
        [`--${name}-border`]: [top, right, bottom, left].map(slice).join(" "),
        [`--${name}-bottom`]: bottom,
        [`--${name}-left`]: left,
        [`--${name}-right`]: right,
        [`--${name}-top`]: top,
      },
      layer,
    );
  });
  return dimmed;
}
