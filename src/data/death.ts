import { BIRD } from "./bird";
import { TILE } from "./screen";
import type { DeathTuning } from "./types";

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
