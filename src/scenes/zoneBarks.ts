import type { Scene } from "phaser";

import type { DialogueLine } from "../data/types";
import type { ZoneBarkScene } from "./ZoneBarkScene";

// The passive notice shares the world's pause lifetime, never a modal's scene or input scope.
export function bindZoneBarks(canPresent: () => boolean, scene: Scene) {
  scene.scene.launch("zoneBark", { canPresent });
  const pause = () => scene.scene.pause("zoneBark");
  const resume = () => scene.scene.resume("zoneBark");
  scene.events.on("pause", pause);
  scene.events.on("resume", resume);
  scene.events.once("shutdown", () => {
    scene.events.off("pause", pause);
    scene.events.off("resume", resume);
    scene.scene.stop("zoneBark");
  });
  const bark = () => scene.scene.get("zoneBark") as ZoneBarkScene;
  return {
    enqueue(lines: readonly DialogueLine[]): void {
      lines.forEach((line) => bark().enqueue(line));
    },
    offer(onStart: () => void, line: DialogueLine): boolean {
      return bark().offer(onStart, line);
    },
    reset(): void {
      bark().reset();
    },
  };
}
