import type { ZoneState } from "../rules/zone.ts";

// Development presentation discards contact-death snapshots after the unchanged physics step.
export function developmentStep(invulnerable: boolean, state: ZoneState): ZoneState {
  return invulnerable && state.death !== undefined && state.death.reason !== "fall"
    ? { ...state, death: undefined }
    : state;
}
