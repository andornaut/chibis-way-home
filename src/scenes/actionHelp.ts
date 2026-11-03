import type { Scene } from "phaser";

import type { ControlAction, Point } from "../data/types";
import { ACTION_HELP, type ActionHelpLayout } from "../layout/actionHelp";
import { CARD_CONTENT } from "../layout/cardFrame";
import { ACTION_FONT, addCardTextIn, BODY_FONT } from "./cardParts";
import { drawHelpChrome } from "./helpChrome";

export function drawActionHelp(
  scene: Scene,
  colour: number,
  at: Point,
  actions: Readonly<Record<ControlAction, string>>,
  layout: ActionHelpLayout,
): void {
  for (const { part, rect } of layout.parts) {
    const placed = { ...rect, x: at.x + rect.x, y: at.y + rect.y };
    if (part.kind === "text") {
      addCardTextIn(scene, BODY_FONT, placed, part.text, colour);
      continue;
    }
    const labelWidth = rect.width - ACTION_HELP.gap - ACTION_HELP.icon;
    addCardTextIn(
      scene,
      ACTION_FONT,
      {
        height: CARD_CONTENT.lineHeight,
        width: labelWidth,
        x: placed.x,
        y: placed.y + (ACTION_HELP.lineHeight - CARD_CONTENT.lineHeight) / 2,
      },
      actions[part.action],
      colour,
    );
    drawHelpChrome(
      scene,
      {
        x: placed.x + labelWidth + ACTION_HELP.gap,
        y: placed.y + (ACTION_HELP.lineHeight - ACTION_HELP.icon) / 2,
      },
      part.action,
    );
  }
}
