import { CAMERA } from "./camera";
import type { ContactCueTuning } from "./types";

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
