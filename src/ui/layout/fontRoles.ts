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
