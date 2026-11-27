import { UI_FONT_FAMILY } from "../chrome/uiFonts.ts";
import { UI_FONT_FACE } from "../layout/index.ts";
import type { InkMeasure } from "./stageSummary.ts";

const MEASURE_SCALE = 16;

// Measures text's ink in the loaded UI font through a 2D canvas, for a scene to hand to the
// layouts that space rows by ink. Without a canvas, a line's ink is taken as its cap height above
// the baseline and the font's descent below it.
export function canvasInk(document: Document): InkMeasure {
  const context = document.createElement("canvas").getContext("2d");
  return ({ size, weight }, text) => {
    if (context === null) {
      return { fall: UI_FONT_FACE.descent * size, rise: 0 };
    }
    // Measured MEASURE_SCALE times larger, since a canvas reports whole pixels.
    context.font = `${weight} ${size * MEASURE_SCALE}px "${UI_FONT_FAMILY}"`;
    const { actualBoundingBoxAscent, actualBoundingBoxDescent } = context.measureText(text);
    return {
      fall: Math.max(0, actualBoundingBoxDescent / MEASURE_SCALE),
      rise: Math.max(0, actualBoundingBoxAscent / MEASURE_SCALE - UI_FONT_FACE.capHeight * size),
    };
  };
}
