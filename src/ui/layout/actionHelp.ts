import { advanceWidth, type BitmapFont, fontMetrics } from "@andornaut/game-kit/text/bitmapFont";

import type { ControlAction, Point, Rect, Size } from "../../data/types";
import { type ActionHelpPart, actionHelpParts } from "../chrome/actionHelp";
import { CARD_CONTENT, CARD_TEXT_SCALE } from "./cardFrame";
import type { CardFonts } from "./contentCard";

// The label-to-icon gap shared by every action help, and the home page's HTML icon and line box.
export const ACTION_HELP = {
  gap: CARD_CONTENT.rowGap,
  icon: 40,
  lineHeight: 40 + 2 * CARD_CONTENT.rowGap,
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
export type ActionHelpPlacement = ActionHelpIcon | ActionHelpText;
export interface ActionHelpLayout extends Size {
  // The y of each line's baseline, in layout coordinates.
  readonly baselines: readonly number[];
  // The control icon's side: a little under one line pitch, so an icon never changes the line
  // spacing.
  readonly icon: number;
  // The distance between consecutive baselines: the body font's line height.
  readonly linePitch: number;
  readonly placements: readonly ActionHelpPlacement[];
}

// How much smaller than one line pitch an inline control icon is drawn.
const ICON_INSET = 4;

// The baseline's offset below a font's line top, at card scale: the capitals' bottom row.
function baselineOffset(font: BitmapFont): number {
  const metrics = fontMetrics(font);
  return (metrics.capTop + metrics.capHeight) * CARD_TEXT_SCALE;
}

// Text and inline control icons laid out like a paragraph: every word on a line sits on that
// line's baseline, lines are one body-font line height apart, and each icon is centred on its
// line's capital height, a little smaller than one line pitch, so it never changes the line spacing.
export function actionHelpLayout(
  fonts: CardFonts,
  actions: Readonly<Record<ControlAction, string>>,
  width: number,
  text: string,
): ActionHelpLayout {
  const linePitch = fonts.body.lineHeight * CARD_TEXT_SCALE;
  const icon = linePitch - ICON_INSET;
  const baseline = baselineOffset(fonts.body);
  const capHeight = fontMetrics(fonts.body).capHeight * CARD_TEXT_SCALE;
  const iconTop = Math.round(baseline - capHeight / 2 - icon / 2);
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
  // Lift every line when an icon on the first line reaches above it.
  const top = Math.max(0, ...iconLines.map((index) => -(index * linePitch + iconTop)));
  const bottom = Math.max(
    lines.length * linePitch,
    ...iconLines.map((index) => index * linePitch + iconTop + icon),
  );
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
