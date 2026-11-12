import type { GameObjects, Scene } from "phaser";

import { DIALOGUE_PANEL_ALPHA } from "../data/dialogues.ts";
import { DIALOGUE_SCREEN } from "../ui/index.ts";

export const DIALOGUE_PANEL_KEY = "ui-dialogue-box";

// The one background for every dialogue, bark and notice panel; only the box is translucent,
// so callers draw portraits and text above it at full opacity.
export function drawDialoguePanel(scene: Scene): GameObjects.Image {
  return scene.add
    .image(DIALOGUE_SCREEN.box.x, DIALOGUE_SCREEN.box.y, DIALOGUE_PANEL_KEY)
    .setOrigin(0)
    .setAlpha(DIALOGUE_PANEL_ALPHA);
}
