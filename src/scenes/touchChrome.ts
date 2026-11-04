import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import { type GameObjects, type Scene, Textures } from "phaser";

import { ART_MANIFEST_KEY, type ArtManifest } from "../assets";
import {
  TOUCH_CHROME_FRAME,
  TOUCH_CHROME_SCALE,
  TOUCH_KNOB_FRAME,
  type TouchChromeKind,
  type TouchChromeLayer,
  touchChromeLayers,
  touchChromePixel,
  type TouchChromePose,
} from "../view/touchChrome";
import { paletteColour } from "./cardParts";

const SOURCE: Readonly<Record<TouchChromeKind, string>> = {
  jump: "ui-touch-jump",
  knob: "ui-move-knob",
  move: "ui-move-hint",
  use: "ui-touch-use",
};

import { uiObject } from "./uiRoots";

export function createChromeTexture(
  scene: Scene,
  key: string,
  logical: number,
  frames: ReadonlyMap<string, readonly TouchChromeLayer[]>,
): string {
  if (scene.textures.exists(key)) {
    return key;
  }
  const size = logical * TOUCH_CHROME_SCALE;
  const stride = size + 2;
  const texture = scene.textures.createCanvas(key, stride * frames.size, stride);
  if (!texture) {
    throw new Error(`Cannot create ${key}`);
  }
  const context = texture.getContext();
  let column = 0;
  for (const [frame, layers] of frames) {
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        image.data.set(
          touchChromePixel(layers, {
            x: (x + 0.5) / TOUCH_CHROME_SCALE,
            y: (y + 0.5) / TOUCH_CHROME_SCALE,
          }),
          4 * (y * size + x),
        );
      }
    }
    context.putImageData(image, column * stride + 1, 1);
    texture.add(frame, 0, column * stride + 1, 1, size, size);
    column++;
  }
  texture.refresh();
  texture.setFilter(Textures.FilterMode.LINEAR);
  return key;
}

// Four game-lifetime texture sheets. Scene-owned sprites are destroyed by normal scene shutdown.
export function createTouchChrome(scene: Scene, kind: TouchChromeKind): GameObjects.Sprite {
  const source = SOURCE[kind];
  const key = `touch-chrome-${kind}`;
  const logical = kind === "knob" ? TOUCH_KNOB_FRAME : TOUCH_CHROME_FRAME;
  if (!scene.textures.exists(key)) {
    const tags = sheetTags(scene.cache.json.get(source) as AsepriteSheet);
    const poses = new Map<string, { pose: TouchChromePose; expanded: boolean }>();
    for (const [tag, frames] of tags) {
      frames.forEach(({ frame }, index) =>
        poses.set(frame, {
          expanded: tag === "press" && index === 0,
          pose: tag as TouchChromePose,
        }),
      );
    }
    const colours = {
      cream: paletteColour(scene, "cream"),
      ink: paletteColour(scene, "ink"),
      white: paletteColour(scene, "white"),
    };
    createChromeTexture(
      scene,
      key,
      logical,
      new Map(
        [...poses].map(([frame, pose]) => [
          frame,
          touchChromeLayers(colours, kind, pose.pose, pose.expanded),
        ]),
      ),
    );
    const manifest = scene.cache.json.get(ART_MANIFEST_KEY) as ArtManifest;
    const once = manifest.sprites.find((entry) => entry.key === source)?.once ?? [];
    for (const [tag, frames] of tags) {
      scene.anims.create({
        frames: frames.map(({ duration, frame }) => ({ duration, frame, key })),
        key: animationKey(key, tag),
        repeat: tagRepeat(once, tag),
      });
    }
  }
  const rest = sheetTags(scene.cache.json.get(source) as AsepriteSheet).get("rest")?.[0]?.frame;
  return uiObject(
    scene,
    scene.add.sprite(0, 0, key, rest).setOrigin(0).setDisplaySize(logical, logical).setAlpha(0.85),
  );
}
