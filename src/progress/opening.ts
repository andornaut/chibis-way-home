import { clamp01, lerp } from "@andornaut/game-kit/numbers";

import type { OpeningBeat, OpeningKeyframe, OpeningLayer } from "../data/types/index.ts";
import type { Progress } from "./save/progress.ts";

export function openingDestination(
  progress: Pick<Progress, "at" | "openingSeen">,
): "map" | "opening" {
  return progress.at === "beginning" && !progress.openingSeen ? "opening" : "map";
}

export function openingPose(progress: number, layer: OpeningLayer): OpeningKeyframe {
  const at = clamp01(progress);
  const before = [...layer.keyframes].reverse().find((frame) => frame.progress <= at)!;
  const after = layer.keyframes.find((frame) => frame.progress > at) ?? before;
  const fraction =
    after === before ? 0 : (at - before.progress) / (after.progress - before.progress);
  return {
    ...before,
    angle: lerp(before.angle, after.angle, fraction),
    position: {
      x: lerp(before.position.x, after.position.x, fraction),
      y: lerp(before.position.y, after.position.y, fraction),
    },
    progress: at,
    scale: lerp(before.scale, after.scale, fraction),
  };
}

export function createOpeningPlayback(onFinish: () => void, beats: readonly OpeningBeat[]) {
  if (beats.length === 0) {
    throw new Error("Opening requires authored beats");
  }
  for (const beat of beats) {
    if (!beat.text || beat.shots.length === 0) {
      throw new Error("Invalid opening beat");
    }
    for (const shot of beat.shots) {
      if (
        (shot.background !== null && (typeof shot.background !== "string" || !shot.background)) ||
        !Number.isFinite(shot.seconds) ||
        shot.seconds <= 0
      ) {
        throw new Error("Invalid opening shot");
      }
      for (const layer of shot.layers) {
        if (
          !layer.art ||
          ![layer.anchor.x, layer.anchor.y].every(Number.isFinite) ||
          layer.keyframes[0]?.progress !== 0 ||
          layer.keyframes.at(-1)?.progress !== 1
        ) {
          throw new Error("Invalid opening layer");
        }
        layer.keyframes.forEach((frame, index) => {
          if (
            !frame.pose ||
            ![frame.progress, frame.position.x, frame.position.y, frame.angle, frame.scale].every(
              Number.isFinite,
            ) ||
            frame.scale <= 0 ||
            frame.progress < 0 ||
            frame.progress > 1 ||
            (index > 0 && frame.progress <= layer.keyframes[index - 1]!.progress)
          ) {
            throw new Error("Invalid opening keyframe");
          }
        });
      }
    }
  }
  let beatIndex = 0;
  let elapsed = 0;
  let finished = false;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    onFinish();
  };
  return {
    advance() {
      if (finished) {
        return;
      }
      if (beatIndex === beats.length - 1) {
        finish();
      } else {
        beatIndex++;
        elapsed = 0;
      }
    },
    frame() {
      const beat = beats[beatIndex]!;
      let time = elapsed;
      for (const [index, shot] of beat.shots.entries()) {
        if (time < shot.seconds || index === beat.shots.length - 1) {
          const progress = Math.min(1, time / shot.seconds);
          return {
            beat,
            beatIndex,
            finished,
            layers: shot.layers.map((layer) => ({ layer, pose: openingPose(progress, layer) })),
            progress,
            shot,
            shotIndex: index,
          };
        }
        time -= shot.seconds;
      }
      throw new Error("Opening shot is missing");
    },
    skip: finish,
    tick(seconds: number) {
      if (!finished && Number.isFinite(seconds)) {
        elapsed += Math.max(0, seconds);
      }
    },
  };
}
