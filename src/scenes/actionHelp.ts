import type { Scene } from "phaser";

import type { Point } from "../data/types";
import type { ActionHelpLayout } from "../ui";
import { ACTION_FONT, addCardText, BODY_FONT } from "./cardParts";
import { drawHelpChrome } from "./helpChrome";

const FONT_KEYS = { body: BODY_FONT, title: ACTION_FONT } as const;

export function drawActionHelp(
  scene: Scene,
  colour: number,
  at: Point,
  layout: ActionHelpLayout,
): void {
  for (const placement of layout.placements) {
    if (placement.kind === "text") {
      addCardText(
        scene,
        FONT_KEYS[placement.font],
        { x: at.x + placement.at.x, y: at.y + placement.at.y },
        placement.text,
        colour,
      );
      continue;
    }
    drawHelpChrome(
      scene,
      { ...placement.rect, x: at.x + placement.rect.x, y: at.y + placement.rect.y },
      placement.action,
    );
  }
}
