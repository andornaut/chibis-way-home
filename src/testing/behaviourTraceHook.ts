import { canonicalTrace, type TraceRecorder } from "../ai/trace";
import type { BirdTuning, ObjectLayout, ZoneLayout } from "../data/types";
import type * as Zone from "../rules/zone";

type ZoneModule = typeof Zone;
type ZoneState = Zone.ZoneState;

// The recorder of the scenario now running; undefined records nothing.
export const TRACE: { active: TraceRecorder | undefined } = { active: undefined };

const NAMES = new WeakMap<ZoneLayout, Map<object, string>>();

function namesOf(layout: ZoneLayout): Map<object, string> {
  let names = NAMES.get(layout);
  if (!names) {
    names = new Map();
    for (const [area, { objects }] of Object.entries(layout.areas)) {
      objects.forEach((object, index) => names!.set(object, `${area}:${index}`));
    }
    NAMES.set(layout, names);
  }
  return names;
}

const isLayoutObject = (value: object): value is ObjectLayout =>
  "character" in value && "origin" in value && "motion" in value;

// One tick of every behaviour-driven object, its spawned transients and Chibi.
export function zoneTraceLine(
  layout: ZoneLayout,
  seconds: number,
  before: ZoneState,
  after: ZoneState,
): string {
  const names = namesOf(layout);
  const same = before.area === after.area && before.attempt === after.attempt;
  const agents = after.behaviours.flatMap((state, index) => {
    if (!state) {
      return [];
    }
    const at = after.objects[index]!;
    const from = same ? before.objects[index] : undefined;
    return [
      {
        at,
        index,
        state,
        velocity: from && { x: (at.x - from.x) / seconds, y: (at.y - from.y) / seconds },
      },
    ];
  });
  return canonicalTrace(
    (value) =>
      names.get(value) ??
      (isLayoutObject(value) ? `layout:${value.character}:${value.art}` : undefined),
    {
      agents,
      area: after.area,
      attempt: after.attempt,
      bird: { vx: after.bird.vx, vy: after.bird.vy, x: after.bird.x, y: after.bird.y },
      cleared: after.cleared,
      death: after.death,
      seconds: after.seconds,
      transients: after.transients,
    },
  );
}

// Wraps the zone step so every call, including speculative walk and navigation steps, records.
export function tracedZone(actual: ZoneModule): ZoneModule {
  const stepZone = (
    skillProfiles: readonly BirdTuning[],
    tuning: BirdTuning,
    layout: ZoneLayout,
    seconds: number,
    input: Zone.ZoneInput,
    zone: ZoneState,
  ): ZoneState => {
    const next = actual.stepZone(skillProfiles, tuning, layout, seconds, input, zone);
    if (TRACE.active && next !== zone) {
      TRACE.active.record(zoneTraceLine(layout, seconds, zone, next));
    }
    return next;
  };
  return { ...actual, stepZone };
}
