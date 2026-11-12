import type { Scene } from "phaser";

import type { ControlAction, Rect } from "../data/types/index.ts";
import { helpChromeLayers, TOUCH_CHROME_FRAME } from "../ui/index.ts";
import { paletteColour } from "./cardParts.ts";
import { createChromeTexture } from "./touchChrome.ts";

// Three static game-lifetime help textures, separate from the transparent animated live controls.
export function drawHelpChrome(scene: Scene, rect: Rect, action: ControlAction) {
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
    .image(rect.x, rect.y, key, "rest")
    .setOrigin(0)
    .setDisplaySize(rect.width, rect.height);
}
