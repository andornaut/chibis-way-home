// Camera, feedback and touch control tuning.

export interface ControlRefusalTuning {
  readonly flashMs: number;
  readonly flashes: number;
  readonly shake: number;
  readonly shakeMs: number;
}

export interface ContactCueTuning {
  readonly borderWidth: number;
  readonly durationMs: number;
  readonly keylineWidth: number;
  readonly tintAlpha: number;
}

export interface WorldShakeTuning {
  readonly distance: number;
  readonly durationMs: number;
  readonly firstOffMs: number;
  readonly secondOnMs: number;
  readonly secondOffMs: number;
}

// How the camera follows him. groundSpot is the fraction of screen height from the top at
// which his feet rest on the ground. seamEase is the fraction of screen width over which the
// ground line blends between chunks, centred on the seam.
export interface CameraTuning {
  readonly contactShake: WorldShakeTuning;
  readonly groundSpot: number;
  readonly seamEase: number;
}

export type ControlAction = "move" | "jump" | "use";

// The touch controls, in base pixels.
export interface TouchTuning {
  // A move touch moves him once it is more than this far left or right of where it started.
  readonly moveDeadZone: number;
  // A press that travels further than this is a drag, not a tap: a tap outside a card closes it.
  readonly tapMaxDistance: number;
}
