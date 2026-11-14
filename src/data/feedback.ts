import { CAMERA } from "./camera.ts";
import type { ContactCueTuning } from "./types/index.ts";

export const CONTACT_CUE: ContactCueTuning = {
  borderWidth: 5,
  durationMs: CAMERA.contactShake.durationMs,
  keylineWidth: 1,
  tintAlpha: 0.12,
};

export const CONTROL_REFUSAL = {
  flashMs: 80,
  flashes: 4,
  shake: 3,
  shakeMs: 40,
} as const;

// The loading bar's pending segment, full hold and fade use independent phase timings.
export const LOADING_TIMING = {
  cycleMs: 1500,
  fadeMs: 150,
  fullMs: 250,
  segment: 0.25,
} as const;

// Each side of the held zone transition fades for this duration.
export const ZONE_TRANSITION = { fadeMs: 250 } as const;
