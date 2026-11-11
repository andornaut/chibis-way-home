import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import {
  cutFrame,
  setNineSlice,
  type SliceInsets,
} from "@andornaut/game-kit/web/ui/dom/sheetFrames";
import { slice } from "@andornaut/game-kit/web/ui/dom/viewUnits";

import type { Rect } from "../../data/types";
import type { Palette } from "../chrome/dim";

// Art's nine-slice frames the HTML UI draws, cut from the images the game already loaded: each
// frame's art key, the animation tag whose first frame it is (the sheet's first frame where
// none), and the name its custom properties take. A whole frame has no nine-slice edges in art's
// manifest and is drawn whole, stretched to its box.
export interface UiFrame {
  readonly art: string;
  readonly name: string;
  readonly tag?: string;
  readonly whole?: true;
}

export const UI_FRAMES: readonly UiFrame[] = [
  { art: "ui-button", name: "ui-button", tag: "normal" },
  { art: "ui-button", name: "ui-button-pressed", tag: "pressed" },
  { art: "ui-button-primary", name: "ui-button-primary", tag: "normal" },
  { art: "ui-button-primary", name: "ui-button-primary-pressed", tag: "pressed" },
  { art: "ui-close", name: "ui-close", tag: "normal", whole: true },
  { art: "ui-close", name: "ui-close-pressed", tag: "pressed", whole: true },
  { art: "ui-settings-card", name: "ui-settings-card" },
];

// The palette colours the HTML UI's CSS reads, as --colour-<name>.
export const UI_COLOURS = ["ink", "white", "yellow"] as const;

export interface SkinFrame {
  readonly name: string;
  // The frame's rect in source, in source pixels.
  readonly rect: Rect;
  // Undefined for a whole frame.
  readonly slice?: SliceInsets;
  readonly source: CanvasImageSource;
}

// Sets each UI colour on layer as --colour-<name>, and each frame for .ui-frame: --<name>-image
// and --<name>-slice (sheetFrames), its border widths as whole CSS px in --<name>-border, and
// its edges as unitless base px in --<name>-top, -right, -bottom and -left. A whole frame sets
// only --<name>-image.
export async function applySkin(
  document: Document,
  palette: Palette,
  frames: readonly SkinFrame[],
  layer: HTMLElement,
): Promise<void> {
  writeLayoutProperties(
    Object.fromEntries(
      UI_COLOURS.map((name) => {
        const colour = palette.colours[name];
        if (colour === undefined) {
          throw new Error(`The palette has no ${name}`);
        }
        return [`--colour-${name}`, colour];
      }),
    ),
    layer,
  );
  const urls = await Promise.all(
    frames.map(({ rect, source }) => cutFrame(document, source, rect)),
  );
  frames.forEach(({ name, slice: insets }, index) => {
    const url = urls[index]!;
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
}
