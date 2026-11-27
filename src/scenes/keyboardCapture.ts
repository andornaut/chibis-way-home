import type { Scene } from "phaser";

import { hasForegroundInput } from "../ui/binding/index.ts";

export function captureTab(
  scene: Pick<Scene, "input"> & Partial<Pick<Scene, "game">>,
  captured: boolean,
): void {
  const document = scene.game?.canvas.ownerDocument;
  if (document !== undefined && hasForegroundInput(document)) {
    scene.input.keyboard?.removeCapture("TAB");
  } else if (captured) {
    scene.input.keyboard?.addCapture("TAB");
  } else {
    scene.input.keyboard?.removeCapture("TAB");
  }
}
