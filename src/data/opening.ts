import motion from "../../art/opening/motion-recipe.json";
import type { OpeningBeat } from "./types";

const TIMING = [
  { seconds: [2.4], text: "opening-friendship" },
  { seconds: [1.6], text: "opening-argument" },
  { seconds: [2, 1.6], text: "opening-packing" },
  { seconds: [2], text: "opening-waking" },
] as const;

// Each beat waits for Continue; shot durations control animation, never input availability.
export const OPENING: readonly OpeningBeat[] = motion.beats.map((beat, index) => {
  const timing = TIMING[index];
  if (!timing || timing.seconds.length !== beat.shots.length) {
    throw new Error("Opening art shots and authored timing must match");
  }
  return {
    shots: beat.shots.map((shot, shotIndex) => ({
      ...shot,
      seconds: timing.seconds[shotIndex]!,
    })),
    text: timing.text,
  };
});
