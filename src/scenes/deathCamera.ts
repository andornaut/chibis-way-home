import { easeProgress } from "@andornaut/game-kit/motion";
import type { Scene } from "phaser";

import { SCREEN } from "../data/screen";
import type { DeathCameraPanTuning, Rect } from "../data/types";

// Pan to the final full sprite at bottom centre before animation, without moving the world.
export function frameDeathCamera(
  tuning: DeathCameraPanTuning,
  onFramed: () => void,
  scene: Scene,
  bird: Rect,
): () => void {
  if (
    ![tuning.bottomInset, tuning.pixelsPerSecond, tuning.minSeconds, tuning.maxSeconds].every(
      Number.isFinite,
    ) ||
    tuning.bottomInset < 0 ||
    tuning.pixelsPerSecond <= 0 ||
    tuning.minSeconds < 0 ||
    tuning.maxSeconds <= 0 ||
    tuning.maxSeconds < tuning.minSeconds
  ) {
    throw new Error("Invalid death camera pan tuning");
  }
  const camera = scene.cameras.main;
  const before = { scrollX: camera.scrollX, scrollY: camera.scrollY };
  const x = bird.x - (SCREEN.width - bird.width) / 2;
  const y = bird.y - (SCREEN.height - bird.height) + tuning.bottomInset;
  const distance = Math.hypot(x - before.scrollX, y - before.scrollY);
  let restored = false;
  let framed = false;
  let panning = false;
  const finish = () => {
    if (restored || framed) {
      return;
    }
    framed = true;
    panning = false;
    onFramed();
  };
  const restore = () => {
    if (restored) {
      return;
    }
    restored = true;
    scene.events.off("shutdown", restore);
    if (panning) {
      camera.panEffect.reset();
      panning = false;
    }
    camera.setScroll(before.scrollX, before.scrollY);
  };
  scene.events.once("shutdown", restore);
  if (distance === 0) {
    finish();
  } else {
    const seconds = Math.min(
      tuning.maxSeconds,
      Math.max(tuning.minSeconds, distance / tuning.pixelsPerSecond),
    );
    panning = true;
    camera.pan(
      x + camera.width / 2,
      y + camera.height / 2,
      seconds * 1000,
      (progress: number) => easeProgress("sineInOut", progress),
      true,
      (_camera, progress) => {
        if (progress === 1) {
          finish();
        }
      },
    );
  }
  return restore;
}
