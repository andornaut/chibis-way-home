import type { Input, Scene } from "phaser";

import { TOUCH } from "../data/touch";
import type { Point, Rect } from "../data/types";
import { modalInput, onScenePointer } from "./modalInput";

interface Modal {
  readonly close?: () => void;
  readonly covered: () => readonly Rect[] | undefined;
}

// All modal gestures stay in the top scene, including presses on the card and required cards.
export function catchModalTaps(scene: Scene, camera: Point, modal: Modal): void {
  let press: { at: Point; cancelled: boolean; id: number; outside: boolean } | undefined;
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
    const point = { x: pointer.x - camera.x, y: pointer.y - camera.y };
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
      press.cancelled ||=
        Math.hypot(pointer.x - camera.x - press.at.x, pointer.y - camera.y - press.at.y) >
        TOUCH.tapMaxDistance;
    }
  });
  const up = (pointer: Input.Pointer, outside: boolean) => {
    if (modal.covered() === undefined) {
      return;
    }
    scene.input.stopPropagation();
    const previous = press;
    press = undefined;
    if (
      !outside &&
      !pointer.wasCanceled &&
      previous?.id === pointer.id &&
      previous.outside &&
      !previous.cancelled &&
      Math.hypot(pointer.x - camera.x - previous.at.x, pointer.y - camera.y - previous.at.y) <=
        TOUCH.tapMaxDistance
    ) {
      modal.close?.();
    }
  };
  onScenePointer(scene, "pointerup", (pointer) => up(pointer, false));
  onScenePointer(scene, "pointerupoutside", (pointer) => up(pointer, true));
}
