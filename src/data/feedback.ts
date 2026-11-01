import { CAMERA } from "./camera";
import type { ContactCueTuning } from "./types";

export const CONTACT_CUE: ContactCueTuning = {
  borderWidth: 5,
  durationMs: CAMERA.contactShake.durationMs,
  keylineWidth: 1,
  tintAlpha: 0.12,
};
