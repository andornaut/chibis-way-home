import { advanceWidth, type BitmapFont, fontMetrics } from "@andornaut/game-kit/text/bitmapFont";

import { ACTION_HELP_LAYOUT, CARD_CONTENT } from "../../data/layout.ts";
import type { ControlAction, Point, Rect, Size } from "../../data/types/index.ts";
import { type ActionHelpPart, actionHelpParts } from "../chrome/actionHelp.ts";
import { CARD_TEXT_SCALE } from "./cardFrame.ts";
import type { CardFonts } from "./contentCard.ts";
import { textInkBounds } from "./textInk.ts";

// The label-to-icon gap shared by every action help, and the home page's HTML icon and line box.
export const ACTION_HELP = {
  gap: CARD_CONTENT.rowGap,
  icon: ACTION_HELP_LAYOUT.homeIcon,
  lineHeight: ACTION_HELP_LAYOUT.homeIcon + 2 * CARD_CONTENT.rowGap,
} as const;

// A word or action label, drawn with its pen (BitmapText origin) at `at`.
interface ActionHelpText {
  readonly at: Point;
  readonly font: keyof CardFonts;
  readonly kind: "text";
  readonly line: number;
  readonly text: string;
}
// A control icon, drawn filling `rect`.
interface ActionHelpIcon {
  readonly action: ControlAction;
  readonly kind: "icon";
  readonly line: number;
  readonly rect: Rect;
}
type ActionHelpPlacement = ActionHelpIcon | ActionHelpText;
export interface ActionHelpLayout extends Size {
  // The y of each line's baseline, in layout coordinates.
  readonly baselines: readonly number[];
  // The control icon's side: one line pitch.
  readonly icon: number;
  // The distance between consecutive baselines: the body font's line height.
  readonly linePitch: number;
  readonly placements: readonly ActionHelpPlacement[];
}

// The baseline's offset below a font's line top, at card scale: the capitals' bottom row.
function baselineOffset(font: BitmapFont): number {
  const metrics = fontMetrics(font);
  return (metrics.capTop + metrics.capHeight) * CARD_TEXT_SCALE;
}

// Text and inline control icons laid out like a paragraph: every word on a line sits on that
// line's baseline and lines are one body-font line height apart. Each icon is one line pitch square
// with its bottom on the first line's baseline; it rises above that line's box, and the layout's
// top clearance covers the overhang. Text with an icon wraps to at most two lines and every icon
// falls on the first, since an icon on a later line would cover the descenders above it.
export function actionHelpLayout(
  fonts: CardFonts,
  actions: Readonly<Record<ControlAction, string>>,
  width: number,
  text: string,
): ActionHelpLayout {
  const linePitch = fonts.body.lineHeight * CARD_TEXT_SCALE;
  const icon = linePitch;
  const baseline = baselineOffset(fonts.body);
  const iconTop = baseline - icon;
  type Piece =
    | { readonly font: keyof CardFonts; readonly kind: "text"; readonly text: string }
    | { readonly action: ControlAction; readonly kind: "icon" };
  type Item = Piece & { readonly x: number };
  const lines: { items: Item[]; width: number }[] = [];
  let line: (typeof lines)[number] = { items: [], width: 0 };
  let space = false;
  const finish = () => {
    lines.push(line);
    line = { items: [], width: 0 };
    space = false;
  };
  // Place a unit that wraps whole: its items at their offsets from the unit's start.
  const append = (size: number, items: readonly (readonly [Piece, number])[]) => {
    if (size > width) {
      throw new Error("Action help item exceeds the native text width");
    }
    let gap = space && line.items.length ? advanceWidth(fonts.body, CARD_TEXT_SCALE, " ") : 0;
    if (line.items.length && line.width + gap + size > width) {
      finish();
      gap = 0;
    }
    for (const [item, offset] of items) {
      line.items.push({ ...item, x: line.width + gap + offset });
    }
    line.width += gap + size;
    space = false;
  };
  const appendPart = (part: ActionHelpPart) => {
    if (part.kind === "text") {
      const advance = advanceWidth(fonts.body, CARD_TEXT_SCALE, part.text);
      append(advance, [[{ font: "body", kind: "text", text: part.text }, 0]]);
      return;
    }
    const label = actions[part.action];
    const iconX = advanceWidth(fonts.title, CARD_TEXT_SCALE, label) + ACTION_HELP.gap;
    append(iconX + icon, [
      [{ font: "title", kind: "text", text: label }, 0],
      [{ action: part.action, kind: "icon" }, iconX],
    ]);
  };
  for (const part of actionHelpParts(text)) {
    if (part.kind === "action") {
      appendPart(part);
      continue;
    }
    for (const word of part.text.match(/\n|[^\S\n]+|[^\s]+/gu) ?? []) {
      if (word === "\n") {
        finish();
      } else if (/^\s+$/u.test(word)) {
        space = true;
      } else {
        appendPart({ kind: "text", text: word });
      }
    }
  }
  if (line.items.length) {
    finish();
  }
  const iconLines = lines.flatMap((row, index) =>
    row.items.some((item) => item.kind === "icon") ? [index] : [],
  );
  if (iconLines.length && lines.length > ACTION_HELP_LAYOUT.maxLines) {
    throw new Error("Action help with an icon wraps past two lines");
  }
  if (iconLines.some((index) => index > 0)) {
    throw new Error("Action help icon falls below the first line");
  }
  // Lift every line by the first-line icon's overhang above the line box.
  const top = iconLines.length ? Math.max(0, -iconTop) : 0;
  const bottom = lines.length * linePitch;
  const placements = lines.flatMap((row, index) => {
    const lineTop = top + index * linePitch;
    return row.items.map((item): ActionHelpPlacement => {
      if (item.kind === "icon") {
        return {
          action: item.action,
          kind: "icon",
          line: index,
          rect: { height: icon, width: icon, x: item.x, y: lineTop + iconTop },
        };
      }
      return {
        at: { x: item.x, y: lineTop + baseline - baselineOffset(fonts[item.font]) },
        font: item.font,
        kind: "text",
        line: index,
        text: item.text,
      };
    });
  });
  return {
    baselines: lines.map((_, index) => top + index * linePitch + baseline),
    height: lines.length ? top + bottom : 0,
    icon,
    linePitch,
    placements,
    width: Math.max(0, ...lines.map((row) => row.width)),
  };
}

// The top of the layout's highest visible content: a word's ink, or a control icon.
export function actionHelpInkTop(fonts: CardFonts, layout: ActionHelpLayout): number {
  return Math.min(
    ...layout.placements.map((placement) =>
      placement.kind === "icon"
        ? placement.rect.y
        : placement.at.y +
          textInkBounds(
            fonts[placement.font],
            CARD_TEXT_SCALE,
            fonts[placement.font].lineHeight * CARD_TEXT_SCALE,
            placement.text,
          ).y,
    ),
  );
}
