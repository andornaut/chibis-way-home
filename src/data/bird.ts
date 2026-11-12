import type { BirdTuning } from "./types/index.ts";

// PLACEHOLDER: starting values for gameplay to tune.
export const BIRD: BirdTuning = {
  airAccel: 2880,
  brakeAccel: 5760,
  coyoteTime: 0.1,
  dash: { cooldownSeconds: 1, durationSeconds: 0.25, speed: 480 },
  doubleJump: true,
  doubleJumpHeightRatio: 0.5,
  flutterFallSpeed: 275,
  gravity: 1780,
  groundAccel: 2880,
  height: 36,
  jumpBuffer: 0.1,
  jumpHopHeight: 40,
  jumpReleaseBlendTime: 0.09,
  jumpRiseTime: 0.36,
  jumpSpeed: 535,
  jumpTapWindow: 0.12,
  walkSpeed: 240,
  width: 24,
};
