import { BIRD } from "./bird.ts";
import { TILE } from "./screen.ts";
import type { DeathTuning } from "./types/index.ts";

export const DEATH: DeathTuning = {
  bounceSpeed: 96,
  cameraPan: { bottomInset: TILE, maxSeconds: 2, minSeconds: 0.5, pixelsPerSecond: 360 },
  fallGravity: BIRD.gravity,
  impactSeconds: 0.08,
  maxFallSpeed: 400,
  recoilSeconds: 0.1,
  recoilVelocity: { x: -48, y: -180 },
  voidFallDistance: 96,
};
