import type { ZoneInput, ZoneState } from "../rules/zone";

export type WalkStep = (input: ZoneInput, zone: ZoneState) => ZoneState;

// One trial group shares immutable states and fixed tuning, layout and step duration.
// Key the complete input so optional controls and external velocity cannot share a transition.
export function walkTransitions(step: WalkStep): WalkStep {
  const states = new WeakMap<ZoneState, Map<string, ZoneState>>();
  return (input, zone) => {
    let inputs = states.get(zone);
    const key = JSON.stringify(input);
    const previous = inputs?.get(key);
    if (previous) {
      return previous;
    }
    const next = step(input, zone);
    if (!inputs) {
      inputs = new Map();
      states.set(zone, inputs);
    }
    inputs.set(key, next);
    return next;
  };
}
