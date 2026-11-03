import type { ZoneInput, ZoneState } from "../rules/zone";

export type WalkStep = (input: ZoneInput, zone: ZoneState) => ZoneState;

// One trial group shares immutable states and fixed tuning, layout and step duration.
// Key the complete input so optional controls and external velocity cannot share a transition.
export function walkTransitions(step: WalkStep): WalkStep {
  const states = new WeakMap<
    ZoneState,
    {
      additional?: Map<string, ZoneState>;
      readonly key: string;
      readonly next: ZoneState;
    }
  >();
  return (input, zone) => {
    const entry = states.get(zone);
    const key = JSON.stringify(input);
    if (entry?.key === key) {
      return entry.next;
    }
    const previous = entry?.additional?.get(key);
    if (previous) {
      return previous;
    }
    const next = step(input, zone);
    if (entry) {
      (entry.additional ??= new Map()).set(key, next);
    } else {
      states.set(zone, { key, next });
    }
    return next;
  };
}
