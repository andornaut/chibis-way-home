import { BIRD } from "./bird";
import type { DeathTuning } from "./types";

export const DEATH: DeathTuning = {
  bounceSpeed: 96,
  fallGravity: BIRD.gravity,
  impactSeconds: 0.08,
  maxFallSpeed: 400,
  recoilSeconds: 0.1,
  recoilVelocity: { x: -48, y: -180 },
  voidFallDistance: 96,
};
