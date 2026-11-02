import type { Scene } from "phaser";

import type { DialogueLine } from "../data/types";
import type { ZoneBark } from "../rules/zone";
import type { ZoneBarkScene } from "./ZoneBarkScene";

// The passive notice shares the world's pause lifetime, never a modal's scene or input scope.
export function bindZoneBarks(
  context: {
    readonly canPresent: () => boolean;
    readonly ownerVisible: (owner: ZoneBark["owner"]) => boolean;
  },
  scene: Scene,
) {
  scene.scene.launch("zoneBark", context);
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
    enqueue(lines: readonly ZoneBark[]): void {
      lines.forEach(({ owner, ...line }) => bark().enqueue(line, owner));
    },
    offer(onStart: () => void, line: DialogueLine, owner?: ZoneBark["owner"]): boolean {
      return bark().offer(onStart, line, owner);
    },
    reset(): void {
      bark().reset();
    },
  };
}
