import type { TraceRecorder } from "../ai/trace.ts";
import type { BirdTuning, ZoneLayout } from "../data/types/index.ts";
import type * as Zone from "../rules/zone.ts";
import { zoneTraceLine } from "../sim/zoneTrace.ts";

type ZoneModule = typeof Zone;

// The recorder of the scenario now running; undefined records nothing.
export const TRACE: { active: TraceRecorder | undefined } = { active: undefined };

// Wraps the zone step so every call, including speculative walk and navigation steps, records.
export function tracedZone(actual: ZoneModule): ZoneModule {
  const stepZone = (
    skillProfiles: readonly BirdTuning[],
    tuning: BirdTuning,
    layout: ZoneLayout,
    seconds: number,
    input: Zone.ZoneInput,
    zone: Zone.ZoneState,
  ): Zone.ZoneState => {
    const next = actual.stepZone(skillProfiles, tuning, layout, seconds, input, zone);
    if (TRACE.active && next !== zone) {
      TRACE.active.record(zoneTraceLine(layout, seconds, zone, next));
    }
    return next;
  };
  return { ...actual, stepZone };
}
