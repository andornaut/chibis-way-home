import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";

import type { PauseChromePose, PauseDiscPose } from "../ui";

// The pause button's art timeline, from art's ui-pause sheet: it rests until pressed, then plays
// its press tag once, each frame for its authored duration, the first swollen, and holds until
// the press lifts.

export interface PauseDiscTimeline {
  readonly held: PauseDiscPose;
  readonly press: readonly { readonly durationMs: number; readonly pose: PauseDiscPose }[];
  readonly rest: PauseDiscPose;
}

export function pauseDiscTimeline(sheet: AsepriteSheet): PauseDiscTimeline {
  const tags = sheetTags(sheet);
  const pose = (tag: PauseChromePose): PauseDiscPose => {
    if (!tags.has(tag)) {
      throw new Error(`ui-pause has no ${tag} tag`);
    }
    return { expanded: false, tag };
  };
  return {
    held: pose("held"),
    press: (tags.get("press") ?? []).map(({ duration }, index) => ({
      durationMs: duration,
      pose: { expanded: index === 0, tag: "press" },
    })),
    rest: pose("rest"),
  };
}

// Plays the press on show, then holds; returns a function that stops it at once and shows the
// rest pose.
export function playPauseDiscPress(
  timeline: PauseDiscTimeline,
  show: (pose: PauseDiscPose) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const step = (index: number) => {
    const frame = timeline.press[index];
    if (frame === undefined) {
      show(timeline.held);
      return;
    }
    show(frame.pose);
    timer = setTimeout(() => step(index + 1), frame.durationMs);
  };
  step(0);
  return () => {
    clearTimeout(timer);
    show(timeline.rest);
  };
}
