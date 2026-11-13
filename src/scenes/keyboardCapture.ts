import type { Scene } from "phaser";

// Keep Tab in the game's active screen while the scene owns keyboard input.
export function captureTab(scene: Pick<Scene, "input">, captured: boolean): void {
  if (captured) {
    scene.input.keyboard?.addCapture("TAB");
  } else {
    scene.input.keyboard?.removeCapture("TAB");
  }
}
