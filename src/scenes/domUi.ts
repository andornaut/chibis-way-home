import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import {
  createImageCache,
  type ImageCache,
  type Reveal,
  revealWhenDecoded,
} from "@andornaut/game-kit/web/ui/dom/imageReady";
import { cutFrame } from "@andornaut/game-kit/web/ui/dom/sheetFrames";
import { Core, type Game, Scale, type Scene } from "phaser";

import manifestJson from "../../public/art/manifest.json" with { type: "json" };
import type { ArtManifest } from "../assets/index.ts";
import {
  applySkin,
  createUiLayer,
  filledFrame,
  loadUiFonts,
  modalColour,
  remappedFrame,
  type SkinFrame,
  UI_FRAMES,
  type UiLayer,
} from "../ui/index.ts";
import { palette } from "./cardParts.ts";
import { sceneFit } from "./playCamera.ts";

// The game's HTML UI layer (src/ui/dom/layer.ts) in #game, over the canvas: kept on the play
// view through every refit, skinned from the loaded art once BootScene has it, and each scene's
// view mounted at the scene's place in the game's scene list.

const MANIFEST = manifestJson as ArtManifest;
const layers = new WeakMap<Game, UiLayer>();
const imageCaches = new WeakMap<Game, ImageCache>();

function sceneImages(scene: Scene, document: Document): ImageCache {
  let cache = imageCaches.get(scene.game);
  if (cache === undefined) {
    cache = createImageCache(document);
    imageCaches.set(scene.game, cache);
  }
  return cache;
}
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

function paletteHex(colours: Readonly<Record<string, string>>, name: string): string {
  const colour = colours[name];
  if (colour === undefined) {
    throw new Error(`The palette has no ${name}`);
  }
  return colour;
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
    const dimmed = await applySkin(document, palette(scene), frames, layer.element);
    const values = [
      ...Array.from(layer.element.style, (name) => layer.element.style.getPropertyValue(name)),
      ...Object.values(dimmed),
    ];
    const urls = values.flatMap((value) =>
      [...String(value).matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]!),
    );
    await sceneImages(scene, document).decoded(urls);
    layer.setDimmedSkin(dimmed);
  };
  await Promise.all([
    loadUiFonts(document.fonts),
    skin().catch((error: unknown) => console.warn("The UI skin failed to load", error)),
  ]);
}

// The controls that stay live while a conversation holds the modal layer: the pause button,
// which opens the pause card over it.
export function conversationControls(scene: Scene): HTMLElement[] {
  return [...(sceneDomUi(scene)?.element.querySelectorAll<HTMLElement>(".pause-button") ?? [])];
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

// Call before mountSceneView. The canvas fallback keeps drawing until revealed resolves true;
// the caller then removes that fallback and enables its DOM input once. A cancelled view stays
// hidden and inert. Scene shutdown cancels a pending reveal before it can enable stale input.
export function revealSceneView(
  scene: Scene,
  view: HTMLElement,
  urls: readonly string[] | Promise<readonly string[]>,
): Reveal {
  const inert = view.inert;
  view.inert = true;
  let cancelled = false;
  const ready = Promise.all([loadUiFonts(view.ownerDocument.fonts), urls]).then(([, urls]) => urls);
  const reveal = revealWhenDecoded(sceneImages(scene, view.ownerDocument), ready, view);
  const cancel = () => {
    cancelled = true;
    view.hidden = true;
    view.inert = true;
    reveal.cancel();
    scene.events.off("shutdown", cancel);
  };
  scene.events.once("shutdown", cancel);
  return {
    cancel,
    revealed: reveal.revealed.then((shown) => {
      if (!shown || cancelled) {
        cancel();
        return false;
      }
      view.inert = inert;
      return true;
    }),
  };
}

// A blob: URL of art's frameName (its sheet's first where none) for an <img>, cut once per game
// from the image the scene's loader has, filled with the palette colour fill where it is opaque
// (as a fill tint draws it) where one is given. Its dimmed cut, through the canvas dim's palette
// ramp, is registered with the UI layer, which shows it while a modal covers the image. A failed
// cut is tried again on the next call.
export function artFrameUrl(
  scene: Scene,
  art: string,
  frameName?: number | string,
  fill?: string,
): Promise<string> {
  const urls = frameUrls.get(scene.game) ?? new Map<string, Promise<string>>();
  frameUrls.set(scene.game, urls);
  const key = `${art}:${String(frameName ?? "")}:${fill ?? ""}`;
  const cached = urls.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const frame = scene.textures.getFrame(art, frameName);
  const rect = { height: frame.cutHeight, width: frame.cutWidth, x: frame.cutX, y: frame.cutY };
  const source = frame.source.image as CanvasImageSource;
  const url = (async () => {
    const lit =
      fill === undefined
        ? { rect, source }
        : {
            rect: { ...rect, x: 0, y: 0 },
            source: filledFrame(document, source, rect, paletteHex(palette(scene).colours, fill)),
          };
    const dim = remappedFrame(document, modalColour(palette(scene)), lit.source, lit.rect);
    const [cut, dimmed] = await Promise.all([
      cutFrame(document, lit.source, lit.rect),
      cutFrame(document, dim, { height: dim.height, width: dim.width, x: 0, y: 0 }),
    ]);
    sceneDomUi(scene)?.dimImage(cut, dimmed);
    sceneImages(scene, document).retain([cut, dimmed]);
    return cut;
  })();
  urls.set(key, url);
  url.catch(() => urls.delete(key));
  return url;
}
