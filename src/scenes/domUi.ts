import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { cutFrame } from "@andornaut/game-kit/web/ui/dom/sheetFrames";
import { Core, type Game, Scale, type Scene } from "phaser";

import manifestJson from "../../public/art/manifest.json";
import type { ArtManifest } from "../assets";
import {
  applySkin,
  createUiLayer,
  loadUiFonts,
  type SkinFrame,
  UI_FRAMES,
  type UiLayer,
} from "../ui";
import { palette } from "./cardParts";
import { sceneFit } from "./playCamera";

// The game's HTML UI layer (src/ui/dom/layer.ts) in #game, over the canvas: kept on the play
// view through every refit, skinned from the loaded art once BootScene has it, and each scene's
// view mounted at the scene's place in the game's scene list.

const MANIFEST = manifestJson as ArtManifest;
const layers = new WeakMap<Game, UiLayer>();
// Each game's cut art frames' blob: URLs, by art key and frame name.
const frameUrls = new WeakMap<Game, Map<string, Promise<string>>>();

// Each UI frame's nine-slice edges, from art's manifest.
function frameSlice(art: string): NonNullable<SkinFrame["slice"]> {
  const slice = MANIFEST.sprites.find(({ key }) => key === art)?.slice;
  if (slice === undefined) {
    throw new Error(`No 9-slice edges for ${art}`);
  }
  return slice;
}

// Mounts game's UI layer in host, the canvas's parent, and returns its removal.
export function mountDomUi(game: Game, host: HTMLElement): () => void {
  const edges = UI_FRAMES.flatMap(({ art, whole }) => {
    if (whole) {
      return [];
    }
    const { bottom, left, right, top } = frameSlice(art);
    return [bottom, left, right, top];
  });
  const layer = createUiLayer(edges, host.ownerDocument);
  host.append(layer.element);
  layers.set(game, layer);
  const fit = () => {
    const { canvas } = game;
    if (canvas?.parentElement === host) {
      layer.fit({ x: canvas.offsetLeft, y: canvas.offsetTop }, sceneFit(game));
    }
  };
  game.events.once(Core.Events.READY, fit);
  game.scale.on(Scale.Events.RESIZE, fit);
  return () => {
    game.scale.off(Scale.Events.RESIZE, fit);
    layers.delete(game);
    layer.dispose();
  };
}

// scene's game's UI layer, where the game mounted one.
export function sceneDomUi(scene: Scene): UiLayer | undefined {
  return layers.get(scene.game);
}

// Loads the UI fonts and cuts art's frames into the UI layer, once the scene's loader has the
// art. Resolves when both are done; a failure is reported and leaves the UI in its fallback font
// or unskinned.
export async function prepareDomUi(scene: Scene): Promise<void> {
  const layer = sceneDomUi(scene);
  if (layer === undefined) {
    return;
  }
  const document = layer.element.ownerDocument;
  const skin = async () => {
    const frames = UI_FRAMES.map(({ art, name, tag, whole }): SkinFrame => {
      const frameName =
        tag === undefined
          ? undefined
          : sheetTags(scene.cache.json.get(art) as AsepriteSheet).get(tag)?.[0]?.frame;
      if (tag !== undefined && frameName === undefined) {
        throw new Error(`No ${tag} frame for ${art}`);
      }
      const frame = scene.textures.getFrame(art, frameName);
      return {
        name,
        rect: { height: frame.cutHeight, width: frame.cutWidth, x: frame.cutX, y: frame.cutY },
        ...(whole === undefined && { slice: frameSlice(art) }),
        source: frame.source.image as CanvasImageSource,
      };
    });
    await applySkin(document, palette(scene), frames, layer.element);
  };
  await Promise.all([
    loadUiFonts(document.fonts),
    skin().catch((error: unknown) => console.warn("The UI skin failed to load", error)),
  ]);
}

// Mounts view in scene's UI layer at the scene's place in the game's scene list, until the
// scene shuts down. Returns its removal.
export function mountSceneView(scene: Scene, view: HTMLElement): () => void {
  const unmount =
    sceneDomUi(scene)?.mount(scene.game.scene.getIndex(scene.sys.settings.key), view) ??
    (() => view.remove());
  scene.events.once("shutdown", unmount);
  return unmount;
}

// A blob: URL of art's frameName (its sheet's first where none) for an <img>, cut once per game
// from the image the scene's loader has. A failed cut is tried again on the next call.
export function artFrameUrl(
  scene: Scene,
  art: string,
  frameName?: number | string,
): Promise<string> {
  const urls = frameUrls.get(scene.game) ?? new Map<string, Promise<string>>();
  frameUrls.set(scene.game, urls);
  const key = `${art}:${String(frameName ?? "")}`;
  const cached = urls.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const frame = scene.textures.getFrame(art, frameName);
  const url = cutFrame(document, frame.source.image as CanvasImageSource, {
    height: frame.cutHeight,
    width: frame.cutWidth,
    x: frame.cutX,
    y: frame.cutY,
  });
  urls.set(key, url);
  url.catch(() => urls.delete(key));
  return url;
}
