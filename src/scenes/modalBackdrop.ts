import { mountModalBackdrop } from "@andornaut/game-kit/view/phaser/modalBackdrop";
import { type GameObjects, type Scene, Scenes } from "phaser";

import { modalColour } from "../view/modalDim";
import { palette, paletteColour } from "./cardParts";
import { modalInput } from "./modalInput";
import { canvasRect, fitCanvasCamera } from "./playCamera";

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
  const fit = () => {
    const { height, width } = canvasRect(scene);
    image?.setDisplaySize(width, height);
  };
  const toBackdrop = (object: GameObjects.GameObject) => {
    cameras.forEach(({ camera }) => camera.ignore(object));
    image = object as GameObjects.Image | GameObjects.Rectangle;
    fit();
  };
  scene.events.on(Scenes.Events.ADDED_TO_SCENE, toBackdrop);
  const backdrop = mountModalBackdrop(
    {
      depth: -100,
      fallbackColour: paletteColour(scene, "ink"),
      remap: alreadyDimmed ? (colour) => colour : modalColour(palette(scene)),
      scene,
    },
    canvasRect(scene),
  );
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
