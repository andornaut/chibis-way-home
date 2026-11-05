import type { CrumblingProfile } from "@andornaut/game-kit/terrain/crumbling";

import type { BehaviourAction, Orbit } from "./types";

export const CRUMBLING_SUPPORT_TUNING = {
  absentSeconds: 2,
  warningSeconds: 0.8,
} as const satisfies CrumblingProfile;

// New obstacle movers (gantry crane, windmill sails, chandelier) travel along their path at this
// many tiles per second and pause this many seconds at each end.
export const OBSTACLE_MOVER_SPEED = 4;
export const OBSTACLE_MOVER_PAUSE = 1;

// The windmill's sail ledges: count of them evenly spaced around the hub, each centre radius tiles
// from it.
export const WINDMILL_SAILS = { count: 4, radius: 7 } as const;

// Sail number sail's path about the hub with id host: the wheel turns against the clock, rising on
// the right (the route side), its sail centres at the obstacle mover speed, and stops for the
// mover pause at each quarter turn, sail 0 starting at the bottom.
export function windmillSailOrbit(host: string, sail: number): Orbit {
  return {
    angularSpeed: -OBSTACLE_MOVER_SPEED / WINDMILL_SAILS.radius,
    host,
    kind: "circle",
    phase: Math.PI / 2 + (2 * Math.PI * sail) / WINDMILL_SAILS.count,
    radius: WINDMILL_SAILS.radius,
    stops: { count: WINDMILL_SAILS.count, seconds: OBSTACLE_MOVER_PAUSE },
  };
}

// A ravine gust's push volume from its emitter's source edge: range tiles long and height rows tall
// from the emitter's bottom, pushing Chibi velocity tiles per second away from the emitter (14
// against a 20 tiles/s walk still advances him 6), with the leaf stream repeated across it.
export const GUST_PULSE = {
  height: 4,
  range: 24,
  velocity: { x: 14, y: 0 },
  visual: { animation: "pulse", art: "woodland-gust-stream", offset: { x: 0, y: 0 }, span: true },
} as const satisfies Omit<Extract<BehaviourAction, { kind: "force-pulse" }>, "kind" | "seconds">;
