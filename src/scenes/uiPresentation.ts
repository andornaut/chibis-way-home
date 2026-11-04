import type { Rect } from "@andornaut/game-kit/rect";
import { remapRgb } from "@andornaut/game-kit/rgba";
import { parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import {
  presentUi,
  releaseUiTintCache,
  type Size,
  type UiFrame,
  type UiSnapshotResult,
} from "@andornaut/game-kit/view/phaser/uiCommands";
import { createUiCompositor, readUiWorldFrame } from "@andornaut/game-kit/view/phaser/uiComposite";
import { uiProjection } from "@andornaut/game-kit/view/phaser/uiProjection";
import { createUiRecorder } from "@andornaut/game-kit/view/phaser/uiSubmitter";
import { Core, type Game, type Scene, Scenes } from "phaser";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { FONT_ROLES, mountUiFonts } from "../ui";
import { bindGameUiPresentation } from "./uiPresentationPort";
import { createUiRootManager } from "./uiRootManager";
import { sceneUiRoots } from "./uiRoots";

interface Capture {
  cancel(): void;
  readonly scene: Scene;
  readonly area: Rect;
  readonly remap: (colour: number) => number;
  readonly complete: (result: UiSnapshotResult) => void;
}
const sourceFonts = new Map<string, ReturnType<typeof parseBitmapFont>>([
  [FONT_ROLES.body, parseBitmapFont(fontBody)],
  [FONT_ROLES.heading, parseBitmapFont(fontTitle)],
]);

// The game keeps one clock and one input system; this canvas presents only its owned UI paint.
export function mountUiPresentation(game: Game): () => void {
  let disposed = false;
  let stop: (() => void) | undefined;
  const start = () => {
    if (disposed) {
      return;
    }
    const world = game.canvas;
    const host = world.parentElement;
    if (!host) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.dataset.gameUi = "";
    canvas.setAttribute("aria-hidden", "true");
    canvas.hidden = true;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    host.append(canvas);
    const createSurface = (size: Size) => {
      const surface = document.createElement("canvas");
      surface.width = size.width;
      surface.height = size.height;
      const ctx = surface.getContext("2d");
      if (!ctx) {
        throw new Error("UI canvas unavailable");
      }
      return ctx;
    };
    const releaseSurface = (surface: CanvasRenderingContext2D) => {
      surface.canvas.width = 0;
      surface.canvas.height = 0;
    };
    const fonts = mountUiFonts();
    let fontsReady = false;
    void fonts.fontsReady.then(
      () => {
        fontsReady = true;
      },
      () => undefined,
    );
    const recorder = createUiRecorder({
      fontsReady: fonts.fontsReady,
      image: (frame) => {
        const image = frame.source.image;
        if (!(image instanceof HTMLImageElement || image instanceof HTMLCanvasElement)) {
          return undefined;
        }
        return {
          image,
          source: { height: frame.cutHeight, width: frame.cutWidth, x: frame.cutX, y: frame.cutY },
        };
      },
      textStyle: (text) => {
        const baseline = sourceFonts.get(text.font)?.baseline;
        if (baseline === undefined) {
          return undefined;
        }
        const { family, role, size, style, weight } = fonts.textStyle({
          font: text.font,
          sourceMetrics: { baseline, size: text.fontData.size },
        });
        return { baseline, face: { family, role, style, weight }, size };
      },
      viewport: ({ camera }) =>
        camera
          ? { height: camera.height, width: camera.width, x: camera.x, y: camera.y }
          : undefined,
    });
    const roots = createUiRootManager(recorder);
    const captures = new Set<Capture>();
    let active = false;
    let disabled = false;
    let frameOpen = false;
    let frameId = 0;
    const fallback = () => {
      disabled = true;
      active = false;
      roots.clear();
      canvas.hidden = true;
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
    const unbind = bindGameUiPresentation(game, {
      capture(scene, area, remap) {
        if (!active || disabled || disposed) {
          return undefined;
        }
        let resolve!: Capture["complete"];
        const ready = new Promise<UiSnapshotResult>((done) => {
          resolve = done;
        });
        let settled = false;
        const settle: Capture["complete"] = (result) => {
          if (settled) {
            return;
          }
          settled = true;
          captures.delete(request);
          scene.events.off("shutdown", destroy);
          resolve(result);
        };
        const destroy = () => settle({ status: "disposed" });
        const request: Capture = {
          area: { ...area },
          cancel: destroy,
          complete: settle,
          remap,
          scene,
        };
        scene.events.once("shutdown", destroy);
        captures.add(request);
        return { destroy, ready };
      },
      fallback,
    });
    const before = () => {
      if (disposed || disabled || !fontsReady) {
        return;
      }
      const scenes = game.scene.scenes.filter(
        (scene) =>
          scene.sys.settings.visible &&
          scene.sys.settings.status >= Scenes.LOADING &&
          scene.sys.settings.status < Scenes.SLEEPING,
      );
      const supported = roots.sync(scenes.map((scene) => ({ roots: sceneUiRoots(scene), scene })));
      if (!supported) {
        fallback();
        return;
      }
      const cssSize = {
        height: parseFloat(world.style.height) || world.clientHeight,
        width: parseFloat(world.style.width) || world.clientWidth,
      };
      canvas.style.left = `${world.offsetLeft}px`;
      canvas.style.top = `${world.offsetTop}px`;
      canvas.style.width = `${cssSize.width}px`;
      canvas.style.height = `${cssSize.height}px`;
      try {
        recorder.begin(
          ++frameId,
          uiProjection({
            captureSize: { height: world.height, width: world.width },
            cssSize,
            devicePixelRatio: window.devicePixelRatio,
          }),
        );
        frameOpen = true;
        active = true;
      } catch {
        fallback();
      }
    };
    const after = () => {
      let frame: UiFrame | undefined;
      if (frameOpen) {
        frameOpen = false;
        frame = recorder.finish();
      }
      if (frame && active && !disabled) {
        try {
          presentUi(
            {
              context,
              createSurface,
              releaseSurface,
              resizeBacking: (size) => {
                canvas.width = size.width;
                canvas.height = size.height;
              },
            },
            frame,
          );
          canvas.hidden = false;
        } catch {
          fallback();
        }
      }
      for (const request of [...captures]) {
        captures.delete(request);
        if (!frame || !active || disabled) {
          request.complete({ reason: "frame", status: "unavailable" });
          continue;
        }
        const renderer = game.renderer;
        if (!("gl" in renderer)) {
          request.complete({ reason: "context", status: "unavailable" });
          continue;
        }
        const gl = renderer.gl,
          attributes = gl.getContextAttributes();
        const compositor = createUiCompositor({
          captureWorld: (query) =>
            attributes
              ? readUiWorldFrame(
                  {
                    alphaMode: !attributes.alpha
                      ? "opaque"
                      : attributes.premultipliedAlpha
                        ? "premultiplied"
                        : "straight",
                    captureSize: { height: world.height, width: world.width },
                    frameId: frame!.id,
                    gl,
                    phase: "post-render",
                  },
                  query,
                )
              : { reason: "context", status: "unavailable" },
          createSurface,
          releaseSurface,
          remap: (pixels) =>
            remapRgb(
              request.remap,
              new Uint8ClampedArray(
                pixels.data.buffer,
                pixels.data.byteOffset,
                pixels.data.byteLength,
              ),
            ),
        });
        const owner = roots.owner(request.scene);
        const result = compositor.capture({
          area: request.area,
          exclude: new Set(owner ? [owner] : []),
          frame,
        });
        compositor.destroy();
        request.complete(result);
      }
    };
    game.events.on(Core.Events.PRE_RENDER, before);
    game.events.on(Core.Events.POST_RENDER, after);
    stop = () => {
      unbind();
      game.events.off(Core.Events.PRE_RENDER, before);
      game.events.off(Core.Events.POST_RENDER, after);
      for (const request of captures) {
        request.complete({ status: "disposed" });
      }
      captures.clear();
      roots.clear();
      recorder.destroy();
      // presentUi retains tinted surfaces made through this canvas's ports across frames.
      releaseUiTintCache({ releaseSurface });
      fonts.destroy();
      canvas.remove();
    };
  };
  if (game.isBooted && game.canvas) {
    start();
  } else {
    game.events.once(Core.Events.READY, start);
  }
  const destroy = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    game.events.off(Core.Events.READY, start);
    game.events.off(Core.Events.DESTROY, destroy);
    stop?.();
  };
  game.events.once(Core.Events.DESTROY, destroy);
  return destroy;
}
