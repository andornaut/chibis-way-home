import type { Scene } from "phaser";

import { DIALOGUE_SCREEN, statsStatement } from "../ui";
import { drawDialogueParagraph } from "./dialogueParagraph";

export function drawStatsStatement(scene: Scene, kind: "clear" | "retry", stage: string): void {
  const paragraph = statsStatement(kind, stage);
  if (!paragraph) {
    return;
  }
  scene.add.image(DIALOGUE_SCREEN.box.x, DIALOGUE_SCREEN.box.y, "ui-dialogue-box").setOrigin(0);
  drawDialogueParagraph(scene, paragraph);
}
