import { rectsOverlap } from "@andornaut/game-kit/rect";

import type { ObjectLayout, Point, Rect } from "../data/types";
import type { Track } from "./motion";

export interface SceneryPlaybackState {
  readonly elapsedSeconds: number;
  readonly status: "active" | "completed" | "waiting";
}

export interface SceneryPlaybackFrame {
  readonly at: Point;
  readonly state: SceneryPlaybackState;
}

// Visibility starts the independent track once; neither camera travel nor Chibi changes it afterward.
export function stepSceneryPlayback(
  context: { readonly seconds: number; readonly track: Track; readonly view: Rect },
  object: ObjectLayout,
  previous: SceneryPlaybackState = { elapsedSeconds: 0, status: "waiting" },
): SceneryPlaybackFrame {
  const duration = context.track.durationSeconds;
  if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
    throw new Error("Missing finite scenery track duration");
  }
  const visible =
    previous.status === "waiting" &&
    rectsOverlap(context.view, { ...object.origin, height: object.height, width: object.width });
  const advances = context.seconds > 0 && (previous.status === "active" || visible);
  const elapsedSeconds = advances
    ? Math.min(duration, previous.elapsedSeconds + context.seconds)
    : previous.elapsedSeconds;
  const state: SceneryPlaybackState = {
    elapsedSeconds,
    status:
      previous.status === "completed" || elapsedSeconds >= duration
        ? "completed"
        : advances
          ? "active"
          : previous.status,
  };
  const offset = context.track.at(elapsedSeconds);
  return { at: { x: object.origin.x + offset.x, y: object.origin.y + offset.y }, state };
}
