import type { Scene } from "phaser";

import { SCREEN } from "../data/screen";
import type { Rect } from "../data/types";

// Frame the final full sprite at bottom centre before animation, without moving the world.
export function frameDeathCamera(scene: Scene, bird: Rect): () => void {
  const camera = scene.cameras.main;
  const before = { scrollX: camera.scrollX, scrollY: camera.scrollY, useBounds: camera.useBounds };
  const x = (SCREEN.width - bird.width) / 2;
  const y = SCREEN.height - bird.height;
  camera.useBounds = false;
  camera.setScroll(bird.x - x, bird.y - y);
  let restored = false;
  const restore = () => {
    if (restored) {
      return;
    }
    restored = true;
    scene.events.off("shutdown", restore);
    camera.useBounds = before.useBounds;
    camera.setScroll(before.scrollX, before.scrollY);
  };
  scene.events.once("shutdown", restore);
  return restore;
}
