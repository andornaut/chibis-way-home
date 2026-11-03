import type { Scene } from "phaser";

import type { AirJumpCueTuning, Rect } from "../data/types";
import type { BirdState } from "../rules/bird";
import { type AirJumpCue, airJumpCue, stepAirJumpCue } from "../view/airJumpCue";

export function mountAirJumpCue(
  tuning: AirJumpCueTuning,
  depth: number,
  colour: (name: string) => number,
  scene: Scene,
) {
  const graphics = scene.add.graphics().setDepth(depth);
  let cue: AirJumpCue | undefined;
  let live = true;
  const clear = () => {
    cue = undefined;
    if (live) {
      graphics.clear();
    }
  };
  const dispose = () => {
    if (!live) {
      return;
    }
    live = false;
    cue = undefined;
    scene.events.off("pause", clear);
    scene.events.off("shutdown", dispose);
    scene.events.off("destroy", dispose);
    graphics.destroy();
  };
  scene.events.on("pause", clear);
  scene.events.once("shutdown", dispose);
  scene.events.once("destroy", dispose);
  return {
    clear,
    draw(frame: Rect, vx: number) {
      if (!live) {
        return;
      }
      graphics.clear();
      if (!scene.sys.isActive()) {
        return;
      }
      for (const pixel of airJumpCue(tuning, frame, vx, cue)) {
        graphics
          .fillStyle(colour(pixel.colour), pixel.alpha)
          .fillRect(pixel.x, pixel.y, pixel.width, pixel.height);
      }
    },
    step(seconds: number, before: BirdState, after: BirdState) {
      if (live && scene.sys.isActive()) {
        cue = stepAirJumpCue(tuning, seconds, before, after, cue);
      }
    },
  };
}
