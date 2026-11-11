import type { Cameras, Input, Scene } from "phaser";

import { TOUCH } from "../data/touch";
import type { Point, Rect } from "../data/types";
import { modalInput, onScenePointer } from "./modalInput";

interface Modal {
  readonly close?: () => void;
  readonly covered: () => readonly Rect[] | undefined;
}

// All modal gestures stay in the top scene, including presses on the card and required cards.
// Presses and their travel are read in base pixels in camera's view.
export function catchModalTaps(
  scene: Scene,
  camera: Pick<Cameras.Scene2D.Camera, "x" | "y" | "zoom">,
  modal: Modal,
): void {
  let press: { at: Point; cancelled: boolean; id: number; outside: boolean } | undefined;
  // A pointer's point in base pixels in camera's view, as playPoint reads it.
  const inView = (pointer: Pick<Input.Pointer, "x" | "y">): Point => ({
    x: (pointer.x - camera.x) / camera.zoom,
    y: (pointer.y - camera.y) / camera.zoom,
  });
  const input = modalInput(scene);
  const refresh = () => {
    if (modal.covered() !== undefined) {
      input.open();
    }
  };
  refresh();
  scene.events.on("preupdate", refresh);
  scene.events.once("shutdown", () => scene.events.off("preupdate", refresh));
  input.subscribe(() => {
    press = undefined;
  });
  onScenePointer(scene, "pointerdown", (pointer) => {
    const covered = modal.covered();
    if (!covered) {
      return;
    }
    scene.input.stopPropagation();
    const point = inView(pointer);
    const inside = covered.some(
      (rect) =>
        point.x >= rect.x &&
        point.x < rect.x + rect.width &&
        point.y >= rect.y &&
        point.y < rect.y + rect.height,
    );
    press = { at: point, cancelled: false, id: pointer.id, outside: !inside };
  });
  onScenePointer(scene, "pointermove", (pointer) => {
    if (modal.covered() === undefined) {
      return;
    }
    scene.input.stopPropagation();
    if (press?.id === pointer.id) {
      const point = inView(pointer);
      press.cancelled ||=
        Math.hypot(point.x - press.at.x, point.y - press.at.y) > TOUCH.tapMaxDistance;
    }
  });
  const up = (pointer: Input.Pointer, outside: boolean) => {
    if (modal.covered() === undefined) {
      return;
    }
    scene.input.stopPropagation();
    const previous = press;
    press = undefined;
    const point = inView(pointer);
    if (
      !outside &&
      !pointer.wasCanceled &&
      previous?.id === pointer.id &&
      previous.outside &&
      !previous.cancelled &&
      Math.hypot(point.x - previous.at.x, point.y - previous.at.y) <= TOUCH.tapMaxDistance
    ) {
      modal.close?.();
    }
  };
  onScenePointer(scene, "pointerup", (pointer) => up(pointer, false));
  onScenePointer(scene, "pointerupoutside", (pointer) => up(pointer, true));
}
