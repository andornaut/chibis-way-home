import { advanceWidth } from "@andornaut/game-kit/text/bitmapFont";

import type { ControlAction, Rect, Size } from "../../data/types";
import { type ActionHelpPart, actionHelpParts } from "../chrome/actionHelp";
import { CARD_CONTENT, CARD_TEXT_SCALE } from "./cardFrame";
import { type CardFonts, cardTextOrigin } from "./contentCard";

export const ACTION_HELP = {
  gap: CARD_CONTENT.rowGap,
  icon: 40,
  lineHeight: 40 + 2 * CARD_CONTENT.rowGap,
} as const;

export interface ActionHelpPlacement {
  readonly part: ActionHelpPart;
  readonly rect: Rect;
}
export interface ActionHelpLayout extends Size {
  readonly parts: readonly ActionHelpPlacement[];
}

export function actionHelpLayout(
  fonts: CardFonts,
  actions: Readonly<Record<ControlAction, string>>,
  width: number,
  text: string,
): ActionHelpLayout {
  const lines: { height: number; parts: ActionHelpPlacement[]; width: number }[] = [];
  let line: (typeof lines)[number] = { height: CARD_CONTENT.lineHeight, parts: [], width: 0 };
  let space = false;
  const finish = () => {
    lines.push(line);
    line = { height: CARD_CONTENT.lineHeight, parts: [], width: 0 };
    space = false;
  };
  const labelWidth = (action: ControlAction) => {
    const text = actions[action];
    const advance = advanceWidth(fonts.title, CARD_TEXT_SCALE, text);
    const offset = cardTextOrigin(
      fonts.title,
      { height: CARD_CONTENT.lineHeight, width: advance, x: 0, y: 0 },
      text,
    ).x;
    return advance + 2 * Math.max(0, offset);
  };
  const append = (part: ActionHelpPart) => {
    const size =
      part.kind === "action"
        ? {
            height: ACTION_HELP.lineHeight,
            width: labelWidth(part.action) + ACTION_HELP.gap + ACTION_HELP.icon,
          }
        : {
            height: CARD_CONTENT.lineHeight,
            width: advanceWidth(fonts.body, CARD_TEXT_SCALE, part.text),
          };
    if (size.width > width) {
      throw new Error("Action help item exceeds the native text width");
    }
    let gap = space && line.parts.length ? advanceWidth(fonts.body, CARD_TEXT_SCALE, " ") : 0;
    if (line.parts.length && line.width + gap + size.width > width) {
      finish();
      gap = 0;
    }
    line.parts.push({ part, rect: { ...size, x: line.width + gap, y: 0 } });
    line.width += gap + size.width;
    line.height = Math.max(line.height, size.height);
    space = false;
  };
  for (const part of actionHelpParts(text)) {
    if (part.kind === "action") {
      append(part);
      continue;
    }
    for (const word of part.text.match(/\n|[^\S\n]+|[^\s]+/gu) ?? []) {
      if (word === "\n") {
        finish();
      } else if (/^\s+$/u.test(word)) {
        space = true;
      } else {
        append({ kind: "text", text: word });
      }
    }
  }
  if (line.parts.length) {
    finish();
  }
  let y = 0;
  const parts = lines.flatMap((row) => {
    const positioned = row.parts.map(({ part, rect }) => ({
      part,
      rect: { ...rect, y: y + Math.round((row.height - rect.height) / 2) },
    }));
    y += row.height + CARD_CONTENT.rowGap;
    return positioned;
  });
  return {
    height: Math.max(0, y - CARD_CONTENT.rowGap),
    parts,
    width: Math.max(0, ...lines.map((row) => row.width)),
  };
}
