import { type RenderFit, renderFit } from "@andornaut/game-kit/view/renderScale";
import { type Cameras, type Input, Scale, type Scene } from "phaser";

import { SCREEN } from "../data/screen";
import type { Point, Rect } from "../data/types";
import { canvasSize, playView, viewShift } from "../ui";

// The canvas's fit, from the scale manager: its backing is the game size, in device pixels, and
// its zoom is 1 / r (followFrameTurn's deviceResolution), so the canvas's CSS size is the game
// size times that zoom.
export function sceneFit(scene: Pick<Scene, "scale">): RenderFit {
  const { gameSize, zoom } = scene.scale;
  return renderFit(SCREEN, 1 / zoom, {
    height: gameSize.height * zoom,
    width: gameSize.width * zoom,
  });
}

// The whole canvas, in base pixels.
export function canvasRect(scene: Pick<Scene, "scale">): Rect {
  return { ...canvasSize(sceneFit(scene)), x: 0, y: 0 };
}

// How far the controls placed in the view's coordinates move to sit in scene's canvas
// (viewShift), in base pixels.
export function sceneViewShift(scene: Pick<Scene, "scale">): Point {
  return viewShift(sceneFit(scene));
}

// Keeps camera's viewport at rectOf the canvas's fit, in device pixels, at the fit's zoom with
// its origin at the top-left, so scrollX and scrollY are the view's top-left in base pixels, now
// and on every resize, until scene shuts down. It reads the scale manager rather than the resize
// event's size, since one refit fires several.
function keepViewport(
  scene: Scene,
  camera: Cameras.Scene2D.Camera,
  rectOf: (fit: RenderFit) => Rect,
): void {
  const fit = () => {
    const at = sceneFit(scene);
    const { height, width, x, y } = rectOf(at);
    camera.setViewport(x, y, width, height).setOrigin(0, 0).setZoom(at.zoom);
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
  keepViewport(scene, camera, ({ backing }) => ({ ...backing, x: 0, y: 0 }));
}

// A pointer's point, in base pixels, in camera's view (scene's main camera by default), for a
// camera that fitPlayCamera or fitCanvasCamera keeps and that never scrolls.
export function playPoint(
  scene: Scene,
  pointer: Pick<Input.Pointer, "x" | "y">,
  camera: Pick<Cameras.Scene2D.Camera, "x" | "y" | "zoom"> = scene.cameras.main,
): Point {
  return { x: (pointer.x - camera.x) / camera.zoom, y: (pointer.y - camera.y) / camera.zoom };
}
