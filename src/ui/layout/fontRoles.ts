import { CARD_CONTENT, DIALOGUE_LAYOUT, THEME_TEXT } from "../../data/layout.ts";

// Native bitmap fonts share one display scale; action labels use the heading weight.
export const FONT_SCALE = 1;
export const FONT_ROLES = {
  action: "font-title",
  body: "font-body",
  heading: "font-title",
} as const;

export const FONT_NATIVE_SIZE = 16;
export const FONT_METRICS = {
  body: { lineHeight: THEME_TEXT.body.lineHeight, size: THEME_TEXT.body.size },
  compactMainHeading: { lineHeight: 20, size: 17 },
  mainHeading: { lineHeight: THEME_TEXT.heading.lineHeight, size: THEME_TEXT.heading.size },
} as const;

// art: Chibi Sans's vertical metrics in both weights, as fractions of the font size: its
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

// The interface's text roles, in base px: each is one class, ui-text-<role> in kebab case
// (src/ui/dom/ui.css), defined once from these values. body, heading, label and supporting are
// the kit theme's roles; the others are this game's.
export const TEXT_ROLE_STYLES = {
  ...THEME_TEXT,
  // A conversation's heading and line, on the dialogue panel's line pitch.
  dialogueHeading: {
    lineHeight: DIALOGUE_LAYOUT.text.pitch,
    size: FONT_METRICS.body.size,
    weight: 700,
  },
  dialogueLine: {
    lineHeight: DIALOGUE_LAYOUT.text.pitch,
    size: FONT_METRICS.body.size,
    weight: 400,
  },
  // A speaker's name, one line as tall as its tab.
  dialogueName: {
    lineHeight: DIALOGUE_LAYOUT.nameTab.height,
    size: FONT_METRICS.body.size,
    weight: 700,
  },
  // A stage face's number, one line as tall as its slot.
  stageNumber: { lineHeight: CARD_CONTENT.lineHeight, size: FONT_METRICS.body.size, weight: 400 },
  // The stage summary's zone name.
  summaryZone: { ...FONT_METRICS.compactMainHeading, weight: 700 },
} as const;
