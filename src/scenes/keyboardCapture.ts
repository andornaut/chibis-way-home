import type { Scene } from "phaser";

// Native Tab remains owned by the document router and modal focus containment.
export function captureTab(scene: Pick<Scene, "input">, captured: boolean): void {
  if (captured) {
    scene.input.keyboard?.removeCapture("TAB");
  }
}
