import { describe, expect, it, vi } from "vitest";

import { OPENING } from "../data/opening";
import type { OpeningBeat, OpeningShot } from "../data/types";
import { createOpeningPlayback, openingDestination, openingPose } from "./opening";

describe("manual opening playback", () => {
  it("chains shots within a beat, holds its final pose, and never advances dialogue on time", () => {
    const done = vi.fn();
    const shots = [
      { background: null, layers: [], seconds: 1 },
      { background: null, layers: [], seconds: 2 },
    ];
    const beats: readonly OpeningBeat[] = [
      { shots, text: "first" },
      { shots: [shots[0]!], text: "last" },
    ];
    const playback = createOpeningPlayback(done, beats);
    playback.tick(shots[0]!.seconds);
    expect(playback.frame()).toMatchObject({ beatIndex: 0, progress: 0, shotIndex: 1 });
    playback.tick(100);
    expect(playback.frame()).toMatchObject({ beatIndex: 0, progress: 1, shotIndex: 1 });
    expect(done).not.toHaveBeenCalled();
    playback.advance();
    expect(playback.frame()).toMatchObject({ beatIndex: 1, progress: 0, shotIndex: 0 });
    playback.advance();
    playback.skip();
    playback.advance();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("permits immediate Continue and whole-sequence Skip, while interrupted playback restarts first", () => {
    const done = vi.fn();
    const playback = createOpeningPlayback(done, OPENING);
    playback.advance();
    expect(playback.frame().beatIndex).toBe(1);
    expect(createOpeningPlayback(done, OPENING).frame().beatIndex).toBe(0);
    expect(done).not.toHaveBeenCalled();
    playback.skip();
    playback.skip();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("interpolates transforms but steps authored poses and parcel occlusion together", () => {
    for (const beat of OPENING) {
      for (const shot of beat.shots) {
        const parcel = shot.layers.find(({ art }) => art === "opening-parcel");
        const front = shot.layers.find(({ art }) => art === "opening-parcel-front");
        if (!parcel || !front) {
          continue;
        }
        const child = shot.layers.find(({ art }) => art === "opening-chibi");
        for (const keyframe of parcel.keyframes) {
          const pose = openingPose(keyframe.progress, parcel);
          expect(openingPose(keyframe.progress, front)).toEqual(pose);
          if (pose.pose === "sealed" && child) {
            expect(openingPose(keyframe.progress, child).visible).toBe(false);
          }
        }
      }
    }
    const layer = OPENING[0]!.shots[0]!.layers[0]!;
    const [first, next] = layer.keyframes;
    const pose = openingPose(next!.progress / 2, layer);
    expect(pose.pose).toBe(first!.pose);
    expect(pose.scale).toBeCloseTo((first!.scale + next!.scale) / 2);
  });

  it.each([
    ["beginning", false, "opening"],
    ["beginning", true, "map"],
    ["map", false, "map"],
    ["map", true, "map"],
  ] as const)("routes %s with opening seen=%s to %s", (at, openingSeen, destination) => {
    expect(openingDestination({ at, openingSeen })).toBe(destination);
  });
});

it.each([null, "texture-background"])(
  "accepts explicit background %s without changing manual playback",
  (background) => {
    const done = vi.fn();
    const beat = { ...OPENING[0]!, shots: [{ ...OPENING[0]!.shots[0]!, background }] };
    const playback = createOpeningPlayback(done, [beat]);
    expect(playback.frame().shot.background).toBe(background);
    playback.tick(100);
    expect(done).not.toHaveBeenCalled();
    playback.advance();
    expect(done).toHaveBeenCalledOnce();
  },
);
it.each([undefined, "", 0, false])("rejects an invalid explicit background %s", (background) => {
  const shot = { ...OPENING[0]!.shots[0]!, background } as unknown as OpeningShot;
  expect(() => createOpeningPlayback(vi.fn(), [{ ...OPENING[0]!, shots: [shot] }])).toThrow(
    "Invalid opening shot",
  );
});
