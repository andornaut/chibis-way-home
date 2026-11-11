import type { Rect } from "@andornaut/game-kit/rect";
import { mountModalBackdrop } from "@andornaut/game-kit/view/phaser/modalBackdrop";
import { type GameObjects, type Scene, Textures } from "phaser";

import { gameUiPresentation } from "./uiPresentationPort";

let nextTexture = 0;
export function mountUiModalBackdrop(
  context: {
    readonly depth: number;
    readonly fallbackColour: number;
    readonly remap: (colour: number) => number;
    readonly scene: Scene;
  },
  // area in the canvas's device pixels, which the capture reads.
  captureArea: Rect,
  // Where the captured image draws, in base pixels.
  area: Rect,
): { destroy(): void; ready: Promise<boolean> } | undefined {
  const { scene } = context;
  const presentation = gameUiPresentation(scene.game);
  const capture = presentation?.capture(scene, captureArea, context.remap);
  if (!capture) {
    return undefined;
  }
  const key = `__ui-modal-backdrop-${nextTexture++}`;
  let disposed = false;
  let image: GameObjects.Image | undefined;
  let legacy: ReturnType<typeof mountModalBackdrop> | undefined;
  const destroy = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    capture.destroy();
    legacy?.destroy();
    image?.destroy();
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    scene.events.off("shutdown", destroy);
  };
  scene.events.once("shutdown", destroy);
  const ready = capture.ready.then(async (result) => {
    if (disposed || result.status === "disposed") {
      return false;
    }
    if (result.status === "captured") {
      const { pixels } = result;
      const texture = scene.textures.createCanvas(key, pixels.width, pixels.height);
      const target = texture?.getContext();
      if (texture && target) {
        const rgba = target.createImageData(pixels.width, pixels.height);
        rgba.data.set(pixels.data);
        target.putImageData(rgba, 0, 0);
        texture.refresh();
        texture.setFilter(Textures.FilterMode.LINEAR);
        image = scene.add
          .image(area.x, area.y, key)
          .setOrigin(0)
          .setScrollFactor(0)
          .setDisplaySize(area.width, area.height)
          .setDepth(context.depth);
        return true;
      }
    }
    presentation!.fallback();
    legacy = mountModalBackdrop(context, captureArea);
    return legacy.ready;
  });
  return { destroy, ready };
}
