import { mountModalBackdrop } from "@andornaut/game-kit/view/phaser/modalBackdrop";
import { renderFit } from "@andornaut/game-kit/view/renderScale";
import { type GameObjects, type Scene, Scenes } from "phaser";

import { SCREEN } from "../data/screen.ts";
import { canvasSize, modalColour, viewShift } from "../ui/index.ts";
import { palette, paletteColour } from "./cardParts.ts";
import { modalInput } from "./modalInput.ts";
import { canvasRect, fitCanvasCamera, sceneFit } from "./playCamera.ts";
import { mountUiModalBackdrop } from "./uiModalBackdrop.ts";

// Capture only the underlying scenes, and draw the owned backdrop before the card cameras.
export function showModalBackdrop(
  scene: Scene,
  alreadyDimmed = false,
): { destroy(): void; ready: Promise<void>; setVisible(visible: boolean): void } {
  const input = modalInput(scene);
  input.open();
  input.ready(false);
  const cameras = scene.cameras.cameras.map((camera) => ({ camera, visible: camera.visible }));
  const backdropCamera = scene.cameras.add();
  fitCanvasCamera(scene, backdropCamera);
  backdropCamera.ignore(scene.children.list);
  const list = scene.cameras.cameras;
  list.splice(list.indexOf(backdropCamera), 1);
  list.unshift(backdropCamera);
  cameras.forEach(({ camera }) => camera.setVisible(false));
  backdropCamera.setVisible(false);
  let disposed = false;
  let image: GameObjects.Image | GameObjects.Rectangle | undefined;
  // A fallback fill covers the whole canvas. A captured image is the whole backing at capture,
  // in device pixels, so it keeps that canvas's size in base pixels and moves with the view
  // (viewShift): its frozen view stays over the live one, unstretched, when a refit changes the
  // canvas's shape.
  const fit = () => {
    if (image?.type !== "Image") {
      const { height, width } = canvasRect(scene);
      image?.setPosition(0, 0).setDisplaySize(width, height);
      return;
    }
    const captured = renderFit(SCREEN, 1, { height: image.height, width: image.width });
    const { height, width } = canvasSize(captured);
    const from = viewShift(captured);
    const to = viewShift(sceneFit(scene));
    image.setPosition(to.x - from.x, to.y - from.y).setDisplaySize(width, height);
  };
  const toBackdrop = (object: GameObjects.GameObject) => {
    cameras.forEach(({ camera }) => camera.ignore(object));
    image = object as GameObjects.Image | GameObjects.Rectangle;
    fit();
  };
  scene.events.on(Scenes.Events.ADDED_TO_SCENE, toBackdrop);
  const context = {
    depth: -100,
    fallbackColour: paletteColour(scene, "ink"),
    remap: alreadyDimmed ? (colour: number) => colour : modalColour(palette(scene)),
    scene,
  };
  // The capture reads the whole backing, in device pixels; the backdrop draws over the whole
  // canvas, in base pixels (fit).
  const area = canvasRect(scene);
  const { height, width } = scene.scale.gameSize;
  const backing = { height, width, x: 0, y: 0 };
  const backdrop =
    mountUiModalBackdrop(context, backing, area) ?? mountModalBackdrop(context, backing);
  const toContent = (object: GameObjects.GameObject) => backdropCamera.ignore(object);
  const destroy = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    scene.events.off(Scenes.Events.ADDED_TO_SCENE, toBackdrop);
    scene.events.off(Scenes.Events.ADDED_TO_SCENE, toContent);
    scene.scale.off("resize", fit);
    backdrop.destroy();
    scene.cameras.remove(backdropCamera);
  };
  scene.events.once("shutdown", destroy);
  scene.scale.on("resize", fit);
  const ready = backdrop.ready.then(() => {
    scene.events.off(Scenes.Events.ADDED_TO_SCENE, toBackdrop);
    if (!disposed) {
      cameras.forEach(({ camera, visible }) => camera.setVisible(visible));
      backdropCamera.setVisible(true);
      scene.events.on(Scenes.Events.ADDED_TO_SCENE, toContent);
      input.ready(true);
    }
  });
  return { destroy, ready, setVisible: (visible) => backdropCamera.setVisible(visible) };
}
