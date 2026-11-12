import { expect, it } from "vitest";

import type { Motion, ObjectLayout } from "../data/types/index.ts";
import { motionTrack } from "./motion.ts";
import { stepSceneryPlayback } from "./sceneryPlayback.ts";

const object = { height: 24, origin: { x: 1000, y: 200 }, width: 32 } as ObjectLayout;
const visible = { height: 360, width: 720, x: 900, y: 0 };
const distant = { ...visible, x: 0 };
const motion: Motion = {
  algorithm: "linear",
  direction: "right",
  distance: 780,
  hopHeight: 28,
  pause: 0,
  playback: "once-visible",
  speed: 97.5,
  variance: 0,
};

it.each(["linear", "hop"] as const)(
  "runs one finite %s leg after first visibility without camera steering or replay",
  (algorithm) => {
    const track = motionTrack({ ...motion, algorithm }, 0, () => 0.5);
    expect(track.durationSeconds).toBe(8);
    const unseen = stepSceneryPlayback({ seconds: 100, track, view: distant }, object);
    expect(unseen).toEqual({ at: object.origin, state: { elapsedSeconds: 0, status: "waiting" } });
    const paused = stepSceneryPlayback({ seconds: 0, track, view: visible }, object, unseen.state);
    expect(paused).toEqual(unseen);
    const first = stepSceneryPlayback({ seconds: 1, track, view: visible }, object, unseen.state);
    expect(first.state).toEqual({ elapsedSeconds: 1, status: "active" });
    const reversed = stepSceneryPlayback({ seconds: 3, track, view: distant }, object, first.state);
    const followed = stepSceneryPlayback({ seconds: 3, track, view: visible }, object, first.state);
    expect(reversed).toEqual(followed);
    expect(reversed.at.x).toBe(1390);
    expect(reversed.at.y).toBe(algorithm === "hop" ? 172 : 200);
    expect(
      stepSceneryPlayback({ seconds: 0, track, view: distant }, object, reversed.state),
    ).toEqual(reversed);
    const complete = stepSceneryPlayback(
      { seconds: 4, track, view: distant },
      object,
      reversed.state,
    );
    expect(complete).toEqual({
      at: { x: 1780, y: 200 },
      state: { elapsedSeconds: 8, status: "completed" },
    });
    expect(
      stepSceneryPlayback({ seconds: 100, track, view: visible }, object, complete.state),
    ).toEqual(complete);
    expect(track.at(100)).toEqual({ x: 780, y: 0 });
  },
);
