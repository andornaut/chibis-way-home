import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import type { Scene } from "phaser";

import { ART_MANIFEST_KEY, type ArtManifest } from "../assets";
import { PAUSE_CHROME_FRAME, pauseChromeLayers, type PauseChromePose } from "../view/pauseChrome";
import type { TouchChromeLayer } from "../view/touchChrome";
import { paletteColour } from "./cardParts";
import { createChromeTexture } from "./touchChrome";

export const PAUSE_CHROME_KEY = "pause-chrome";

export function createPauseChrome(scene: Scene) {
  const tags = sheetTags(scene.cache.json.get("ui-pause") as AsepriteSheet);
  if (!scene.textures.exists(PAUSE_CHROME_KEY)) {
    const colours = {
      cream: paletteColour(scene, "cream"),
      dslate: paletteColour(scene, "dslate"),
      ink: paletteColour(scene, "ink"),
      navy: paletteColour(scene, "navy"),
      white: paletteColour(scene, "white"),
    };
    const frames = new Map<string, readonly TouchChromeLayer[]>();
    for (const [tag, sequence] of tags) {
      sequence.forEach(({ frame }, index) =>
        frames.set(
          frame,
          pauseChromeLayers(colours, tag as PauseChromePose, tag === "press" && index === 0),
        ),
      );
    }
    createChromeTexture(scene, PAUSE_CHROME_KEY, PAUSE_CHROME_FRAME, frames);
    const once =
      (scene.cache.json.get(ART_MANIFEST_KEY) as ArtManifest).sprites.find(
        (entry) => entry.key === "ui-pause",
      )?.once ?? [];
    for (const [tag, sequence] of tags) {
      scene.anims.create({
        frames: sequence.map(({ duration, frame }) => ({ duration, frame, key: PAUSE_CHROME_KEY })),
        key: animationKey(PAUSE_CHROME_KEY, tag),
        repeat: tagRepeat(once, tag),
      });
    }
  }
  return scene.add
    .sprite(0, 0, PAUSE_CHROME_KEY, tags.get("rest")?.[0]?.frame)
    .setOrigin(0)
    .setDisplaySize(PAUSE_CHROME_FRAME, PAUSE_CHROME_FRAME)
    .setAlpha(1);
}
