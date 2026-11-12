import { afterEach, expect, it, vi } from "vitest";

import sheet from "../../public/art/sprites/ui-pause.json" with { type: "json" };
import type { PauseDiscPose } from "../ui/index.ts";
import { pauseDiscTimeline, playPauseDiscPress } from "./pauseChrome.ts";

afterEach(() => vi.useRealTimers());

// Each frame of a tag in the authored sheet, with its duration.
const frames = (tag: string) => {
  const { from, to } = sheet.meta.frameTags.find(({ name }) => name === tag)!;
  return Object.values(sheet.frames).slice(from, to + 1);
};

it("copies the authored rest, press and held timeline, the press's first frame swollen", () => {
  expect(pauseDiscTimeline(sheet as never)).toEqual({
    held: { expanded: false, tag: "held" },
    press: frames("press").map(({ duration }, index) => ({
      durationMs: duration,
      pose: { expanded: index === 0, tag: "press" },
    })),
    rest: { expanded: false, tag: "rest" },
  });
});

it("plays the press once for its frames' durations, then holds until stopped, then rests", () => {
  vi.useFakeTimers();
  const timeline = pauseDiscTimeline(sheet as never);
  const shown: PauseDiscPose[] = [];
  const stop = playPauseDiscPress(timeline, (pose) => shown.push(pose));
  for (const { durationMs } of timeline.press) {
    vi.advanceTimersByTime(durationMs);
  }
  vi.advanceTimersByTime(1000);
  expect(shown).toEqual([...timeline.press.map(({ pose }) => pose), timeline.held]);
  stop();
  expect(shown.at(-1)).toEqual(timeline.rest);
  vi.advanceTimersByTime(1000);
  expect(shown).toHaveLength(timeline.press.length + 2);
});
