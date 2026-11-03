import type { Scene } from "phaser";

import type { ControlAction, Point } from "../data/types";
import { ACTION_HELP, type ActionHelpLayout } from "../layout/actionHelp";
import { CARD_CONTENT } from "../layout/cardFrame";
import { ACTION_HELP_ICONS, ACTION_HELP_KNOB } from "../view/actionHelp";
import { ACTION_FONT, addCardTextIn, BODY_FONT } from "./cardParts";

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
    const face = ACTION_HELP_ICONS[part.action];
    const x = placed.x + labelWidth + ACTION_HELP.gap;
    const y = placed.y + (ACTION_HELP.lineHeight - ACTION_HELP.icon) / 2;
    scene.add
      .image(x, y, face.key, face.frame)
      .setOrigin(0)
      .setDisplaySize(ACTION_HELP.icon, ACTION_HELP.icon);
    if (part.action === "move") {
      scene.add
        .image(
          x + ACTION_HELP.icon / 2,
          y + ACTION_HELP.icon / 2,
          ACTION_HELP_KNOB.key,
          ACTION_HELP_KNOB.frame,
        )
        .setOrigin(0.5)
        .setScale(ACTION_HELP.icon / face.width);
    }
  }
}
