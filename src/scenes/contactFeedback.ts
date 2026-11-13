import type { GameObjects, Scene } from "phaser";

import { SCREEN } from "../data/screen.ts";
import type { ContactCueTuning, WorldShakeTuning } from "../data/types/index.ts";
import { contactBorder, contactCueOn, contactOverscan, contactWorldOffset } from "../ui/index.ts";
import { paletteColour } from "./scenePalette.ts";

const running = new WeakMap<Scene["events"], () => void>();
let nextCapture = 0;

export function cancelContactFeedback(events: Scene["events"]): void {
  running.get(events)?.();
}

// Capturing only the world gives edge padding without moving or copying the fixed controls.
export function playContactFeedback(
  scene: Scene,
  options: {
    readonly cue: ContactCueTuning;
    readonly depth: number;
    readonly reducedMotion: boolean;
    readonly shake: WorldShakeTuning;
  },
): void {
  cancelContactFeedback(scene.events);
  const { cue, depth, reducedMotion, shake } = options;
  const camera = scene.cameras.main;
  const base = { x: camera.scrollX, y: camera.scrollY };
  const key = `__contact-edge-${nextCapture++}`;
  const view = { ...SCREEN, x: 0, y: 0 };
  const hidden = reducedMotion
    ? []
    : scene.game.scene
        .getScenes(false)
        .flatMap((entry) => entry.cameras?.cameras ?? [])
        .filter((value) => value !== camera)
        .map((value) => ({ camera: value, visible: value.visible }));
  hidden.forEach(({ camera }) => camera.setVisible(false));
  const edges: { image: GameObjects.Image; x: number; y: number }[] = [];
  let graphics: GameObjects.Graphics | undefined;
  let active = true;
  let started = scene.game.loop.time;
  let moving = false;
  const restoreHud = () => hidden.forEach(({ camera, visible }) => camera.setVisible(visible));
  const stop = () => {
    if (!active) {
      return;
    }
    active = false;
    camera.setScroll(base.x, base.y);
    restoreHud();
    scene.events.off("postupdate", place);
    scene.events.off("shutdown", stop);
    edges.forEach(({ image }) => image.destroy());
    graphics?.destroy();
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    running.delete(scene.events);
  };
  const border = contactBorder(cue, view);
  const place = () => {
    if (!active) {
      return;
    }
    const elapsed = scene.game.loop.time - started;
    if (elapsed >= Math.max(shake.durationMs, cue.durationMs)) {
      stop();
      return;
    }
    const offset = moving ? contactWorldOffset(shake, elapsed) : { x: 0, y: 0 };
    camera.setScroll(base.x - offset.x, base.y - offset.y);
    edges.forEach(({ image, x, y }) => image.setPosition(x + offset.x, y + offset.y));
    graphics?.clear();
    if (graphics && contactCueOn(shake, cue, reducedMotion, elapsed)) {
      graphics.fillStyle(paletteColour(scene, "red"), cue.tintAlpha);
      graphics.fillRect(view.x, view.y, view.width, view.height);
      graphics.fillStyle(paletteColour(scene, "red"));
      border.band.forEach((rect) => graphics!.fillRect(rect.x, rect.y, rect.width, rect.height));
      graphics.fillStyle(paletteColour(scene, "ink"));
      border.keyline.forEach((rect) => graphics!.fillRect(rect.x, rect.y, rect.width, rect.height));
    }
  };
  const begin = () => {
    started = scene.game.loop.time;
    graphics = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    scene.events.on("postupdate", place);
    place();
  };
  running.set(scene.events, stop);
  scene.events.once("shutdown", stop);
  if (reducedMotion) {
    begin();
    return;
  }
  // The snapshot is the view's device pixels; its frames are cut at the same zoom and drawn back
  // at their base-pixel size.
  const { zoom } = camera;
  const device = (value: number) => Math.round(value * zoom);
  scene.game.renderer.snapshotArea(camera.x, camera.y, camera.width, camera.height, (snapshot) => {
    if (!active) {
      return;
    }
    restoreHud();
    if (typeof HTMLImageElement !== "undefined" && snapshot instanceof HTMLImageElement) {
      const texture = scene.textures.addImage(key, snapshot);
      if (texture) {
        contactOverscan(shake.distance, view).forEach(({ source, target }, index) => {
          const frame = `edge-${index}`;
          const x = device(source.x);
          const y = device(source.y);
          texture.add(
            frame,
            0,
            x,
            y,
            device(source.x + source.width) - x,
            device(source.y + source.height) - y,
          );
          const image = scene.add
            .image(target.x, target.y, key, frame)
            .setOrigin(0)
            .setDisplaySize(target.width, target.height)
            .setScrollFactor(0)
            .setDepth(depth);
          edges.push({ image, x: target.x, y: target.y });
        });
        moving = true;
      }
    }
    begin();
  });
}
