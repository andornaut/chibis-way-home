import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import { densityTexels } from "@andornaut/game-kit/view/renderScale";
import { Core, type GameObjects, type Scene, Textures } from "phaser";

import { ART_MANIFEST_KEY, type ArtManifest } from "../assets/index.ts";
import {
  TOUCH_CHROME_FRAME,
  TOUCH_KNOB_FRAME,
  type TouchChromeKind,
  type TouchChromeLayer,
  touchChromeLayers,
  touchChromePixel,
  type TouchChromePose,
} from "../ui/index.ts";
import { paletteColour } from "./cardParts.ts";
import { sceneFit } from "./playCamera.ts";

const SOURCE: Readonly<Record<TouchChromeKind, string>> = {
  jump: "ui-touch-jump",
  knob: "ui-move-knob",
  move: "ui-move-hint",
  use: "ui-touch-use",
};

import { uiObject } from "./uiRoots.ts";

interface ChromeSheet {
  readonly frames: ReadonlyMap<string, readonly TouchChromeLayer[]>;
  readonly logical: number;
  texels: number;
}
type ChromeScene = Pick<Scene, "game" | "scale" | "textures">;
type ChromeObject = GameObjects.GameObject &
  Partial<Pick<GameObjects.Sprite, "scaleX" | "scaleY" | "setScale" | "setSizeToFrame">> & {
    readonly list?: unknown;
    readonly texture?: unknown;
  };

const gameSheets = new WeakMap<object, Map<string, ChromeSheet>>();

// Screen pixels per base pixel: the canvas's CSS pixels per base pixel (its fit) times the full
// device pixel ratio, the UI overlay's density (src/scenes/uiPresentation.ts), above the WebGL
// backing's capped one.
export function chromeDensity(scene: Pick<Scene, "scale">): number {
  return sceneFit(scene).fit * (globalThis.devicePixelRatio || 1);
}

function paintSheet(texture: Textures.CanvasTexture, sheet: ChromeSheet): void {
  const { frames, logical, texels } = sheet;
  const scale = texels / logical;
  const stride = texels + 2;
  texture.setSize(stride * frames.size, stride);
  const context = texture.getContext();
  context.clearRect(0, 0, stride * frames.size, stride);
  let column = 0;
  for (const [frame, layers] of frames) {
    const image = context.createImageData(texels, texels);
    for (let y = 0; y < texels; y++) {
      for (let x = 0; x < texels; x++) {
        image.data.set(
          touchChromePixel(scale, layers, { x: (x + 0.5) / scale, y: (y + 0.5) / scale }),
          4 * (y * texels + x),
        );
      }
    }
    const left = column * stride + 1;
    context.putImageData(image, left, 1);
    if (texture.has(frame)) {
      texture.get(frame).setSize(texels, texels, left, 1);
    } else {
      texture.add(frame, 0, left, 1, texels, texels);
    }
    column++;
  }
  texture.refresh();
}

// Keeps each object drawn from texture at its display size across a repaint from `from` to `to`
// texels per frame.
function rescaleUsers(
  objects: readonly unknown[],
  texture: Textures.CanvasTexture,
  from: number,
  to: number,
): void {
  for (const object of objects as readonly ChromeObject[]) {
    if (Array.isArray(object.list)) {
      rescaleUsers(object.list, texture, from, to);
    }
    if (object.texture === texture && object.setScale) {
      object.setScale((object.scaleX! * from) / to, (object.scaleY! * from) / to);
      object.setSizeToFrame?.();
    }
  }
}

// Repaints every chrome sheet whose texel size no longer matches the screen, so each texel stays
// one screen pixel across resizes, rotations, zoom and device pixel ratio changes.
export function sharpenChrome(scene: ChromeScene): void {
  const sheets = gameSheets.get(scene.game);
  if (!sheets) {
    return;
  }
  const density = chromeDensity(scene);
  for (const [key, sheet] of sheets) {
    const texels = densityTexels(density, sheet.logical);
    if (texels === sheet.texels) {
      continue;
    }
    const texture = scene.textures.get(key) as Textures.CanvasTexture;
    const from = sheet.texels;
    sheet.texels = texels;
    paintSheet(texture, sheet);
    for (const owner of scene.game.scene.scenes) {
      rescaleUsers(owner.children.list, texture, from, texels);
    }
  }
}

// A game-lifetime sheet of frames painted from vector layers at one texel per screen pixel, and
// repainted before any frame that renders after the screen density changes. The edges' coverage
// is painted in, so nearest sampling at that one-to-one scale keeps them sharp where linear
// sampling at a fractional screen position would blur them across two pixels.
export function createChromeTexture(
  scene: ChromeScene,
  key: string,
  logical: number,
  frames: ReadonlyMap<string, readonly TouchChromeLayer[]>,
): string {
  if (scene.textures.exists(key)) {
    return key;
  }
  const sheet = { frames, logical, texels: densityTexels(chromeDensity(scene), logical) };
  const texture = scene.textures.createCanvas(
    key,
    (sheet.texels + 2) * frames.size,
    sheet.texels + 2,
  );
  if (!texture) {
    throw new Error(`Cannot create ${key}`);
  }
  paintSheet(texture, sheet);
  texture.setFilter(Textures.FilterMode.NEAREST);
  let sheets = gameSheets.get(scene.game);
  if (!sheets) {
    sheets = new Map();
    gameSheets.set(scene.game, sheets);
    const view = { game: scene.game, scale: scene.scale, textures: scene.textures };
    scene.game.events.on(Core.Events.POST_STEP, () => sharpenChrome(view));
  }
  sheets.set(key, sheet);
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
