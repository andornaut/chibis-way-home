import { type Cameras, type Input, Scale, type Scene } from "phaser";

import type { Point, Rect, Size } from "../data/types";
import { playView } from "../ui";

// The whole canvas, in base pixels.
export function canvasRect(scene: Scene): Rect {
  const { height, width } = scene.scale.gameSize;
  return { height: Math.floor(height), width: Math.floor(width), x: 0, y: 0 };
}

// Keeps camera's viewport at rectOf the canvas's size, now and on every resize, until scene
// shuts down.
function keepViewport(
  scene: Scene,
  camera: Cameras.Scene2D.Camera,
  rectOf: (canvasSize: Size) => Rect,
): void {
  const fit = () => {
    const { height, width, x, y } = rectOf(scene.scale.gameSize);
    camera.setViewport(x, y, width, height);
  };
  fit();
  scene.scale.on(Scale.Events.RESIZE, fit);
  scene.events.once("shutdown", () => scene.scale.off(Scale.Events.RESIZE, fit));
}

// Keeps camera (scene's main camera by default) on the game's view in the canvas (playView).
export function fitPlayCamera(scene: Scene, camera = scene.cameras.main): void {
  keepViewport(scene, camera, playView);
}

// Keeps camera on the whole canvas, for controls anchored to its corners.
export function fitCanvasCamera(scene: Scene, camera: Cameras.Scene2D.Camera): void {
  keepViewport(scene, camera, () => canvasRect(scene));
}

// A pointer's point in camera's view (scene's main camera by default), for a camera that
// fitPlayCamera keeps on the game's view and that never scrolls.
export function playPoint(
  scene: Scene,
  pointer: Input.Pointer,
  camera = scene.cameras.main,
): Point {
  return { x: pointer.x - camera.x, y: pointer.y - camera.y };
}
