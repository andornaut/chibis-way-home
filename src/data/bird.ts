import type { BirdTuning } from "./types";

// PLACEHOLDER: starting values for gameplay to tune.
export const BIRD: BirdTuning = {
  airAccel: 2880,
  brakeAccel: 5760,
  coyoteTime: 0.1,
  dash: { cooldownSeconds: 0.65, durationSeconds: 0.14, speed: 640 },
  doubleJump: true,
  flutterFallSpeed: 275,
  gravity: 1780,
  groundAccel: 2880,
  height: 36,
  jumpBuffer: 0.1,
  jumpHopHeight: 40,
  jumpReleaseBlendTime: 0.09,
  jumpRiseTime: 0.32,
  jumpSpeed: 535,
  jumpTapWindow: 0.1,
  walkSpeed: 288,
  width: 24,
};
