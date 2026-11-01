import type { GameObjects, Scene, Time, Tweens } from "phaser";

import { CONTROL_REFUSAL } from "../data/feedback";
import type { ControlRefusalTuning } from "../data/types";
import { paletteColour } from "./cardParts";

interface RefusalPart {
  readonly active: boolean;
  readonly x: number;
  setX(x: number): unknown;
}

// Disabled faces remain unchanged; motion and label emphasis acknowledge the refused action.
export function refuseControl(
  scene: Scene,
  reducedMotion: boolean,
  parts: readonly RefusalPart[],
  labels: readonly GameObjects.BitmapText[],
  complete: () => void = () => undefined,
): () => void {
  const { flashMs, flashes, shake, shakeMs }: ControlRefusalTuning = CONTROL_REFUSAL;
  const positions = parts.map((part) => ({ part, x: part.x }));
  const colours = labels.map(
    (label) =>
      [label.tintTopLeft, label.tintTopRight, label.tintBottomLeft, label.tintBottomRight] as const,
  );
  let stopped = false;
  let timer: Time.TimerEvent | undefined;
  let tween: Tweens.Tween | undefined;
  const restore = () =>
    labels.forEach((label, index) => {
      if (label.active) {
        label.setTint(...colours[index]!);
      }
    });
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    timer?.remove(false);
    tween?.stop();
    positions.forEach(({ part, x }) => {
      if (part.active) {
        part.setX(x);
      }
    });
    restore();
    scene.events.off("shutdown", stop);
    complete();
  };
  scene.events.once("shutdown", stop);
  if (reducedMotion) {
    labels.forEach((label) => label.setTint(paletteColour(scene, "red")));
    timer = scene.time.delayedCall(flashMs * flashes, stop);
    return stop;
  }
  if (parts.length > 0) {
    tween = scene.tweens.add({
      duration: shakeMs,
      repeat: flashes - 1,
      targets: [...parts],
      x: `+=${shake}`,
      yoyo: true,
    });
  }
  let ticks = 0;
  timer = scene.time.addEvent({
    callback: () => {
      if (stopped) {
        return;
      }
      ticks += 1;
      if (ticks % 2 === 1) {
        labels.forEach((label) => {
          if (label.active) {
            label.setTint(paletteColour(scene, "red"));
          }
        });
      } else {
        restore();
      }
      if (ticks >= flashes) {
        stop();
      }
    },
    delay: flashMs,
    repeat: flashes - 1,
  });
  return stop;
}
