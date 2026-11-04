import type { Scene } from "phaser";

import type { ControlAction, Point } from "../data/types";
import { ACTION_HELP, helpChromeLayers, TOUCH_CHROME_FRAME } from "../ui";
import { paletteColour } from "./cardParts";
import { createChromeTexture } from "./touchChrome";

// Three static game-lifetime help textures, separate from the transparent animated live controls.
export function drawHelpChrome(scene: Scene, at: Point, action: ControlAction) {
  const key = `help-chrome-${action}`;
  if (!scene.textures.exists(key)) {
    const colours = {
      cream: paletteColour(scene, "cream"),
      ink: paletteColour(scene, "ink"),
      navy: paletteColour(scene, "navy"),
      white: paletteColour(scene, "white"),
    };
    createChromeTexture(
      scene,
      key,
      TOUCH_CHROME_FRAME,
      new Map([["rest", helpChromeLayers(colours, action)]]),
    );
  }
  return scene.add
    .image(at.x, at.y, key, "rest")
    .setOrigin(0)
    .setDisplaySize(ACTION_HELP.icon, ACTION_HELP.icon);
}
