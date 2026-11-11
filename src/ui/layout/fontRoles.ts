// Native bitmap fonts share one display scale; action labels use the heading weight.
export const FONT_SCALE = 1;
export const FONT_ROLES = {
  action: "font-title",
  body: "font-body",
  heading: "font-title",
} as const;

export const FONT_NATIVE_SIZE = 16;
export const FONT_METRICS = {
  body: { lineHeight: 20, size: 16 },
  compactMainHeading: { lineHeight: 20, size: 17 },
  mainHeading: { lineHeight: 28, size: 24 },
} as const;

// art: Liberation Sans's vertical metrics in both weights, as fractions of the font size: its
// hhea ascent and descent, which set a CSS line's content area, and its OS/2 cap height.
export const UI_FONT_FACE = {
  ascent: 1854 / 2048,
  capHeight: 1409 / 2048,
  descent: 434 / 2048,
} as const;

// How far the cap height's top sits below the top of a CSS line box of metrics in the UI font: the
// half-leading, then the ascent above the cap height.
export function capTop(metrics: { readonly lineHeight: number; readonly size: number }): number {
  const { ascent, capHeight, descent } = UI_FONT_FACE;
  const { lineHeight, size } = metrics;
  return (lineHeight - (ascent + descent) * size) / 2 + (ascent - capHeight) * size;
}
