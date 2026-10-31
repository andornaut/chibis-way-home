import type { Scene } from "phaser";

import { SCREEN } from "../data/screen";
import type { Rect } from "../data/types";
import { CARD_CONTENT } from "../layout/contentCard";

// Reframe the paused world before its snapshot; the bird and all simulation state stay fixed.
export function frameDeathBackdrop(scene: Scene, card: Rect, bird: Rect): () => void {
  const camera = scene.scene.get("zone").cameras.main;
  const before = { scrollX: camera.scrollX, scrollY: camera.scrollY, useBounds: camera.useBounds };
  const x = (SCREEN.width - bird.width) / 2;
  const y = Math.min(card.y + card.height + CARD_CONTENT.gap, SCREEN.height - bird.height);
  camera.useBounds = false;
  camera.setScroll(before.scrollX + bird.x - x, before.scrollY + bird.y - y);
  let restored = false;
  const restore = () => {
    if (restored) {
      return;
    }
    restored = true;
    camera.useBounds = before.useBounds;
    camera.setScroll(before.scrollX, before.scrollY);
  };
  scene.events.once("shutdown", restore);
  return restore;
}
