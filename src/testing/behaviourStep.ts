import type { BirdTuning, ObjectLayout, Point } from "../data/types/index.ts";
import type { BirdState } from "../rules/bird/index.ts";
import {
  type BehaviourGeometry,
  type BehaviourState,
  type BehaviourStep,
  behaviourWorld,
  stepEncounter,
} from "../rules/boss/index.ts";

// The encounter step of a fixture that holds its own geometry, without a map, streams or
// observer, read back as the behaviour step: its entry actions in order and its distance escape.
export function stepBehaviour(
  tuning: BirdTuning,
  object: ObjectLayout,
  geometry: BehaviourGeometry,
  seconds: number,
  bird: BirdState,
  at: Point,
  state: BehaviourState,
): BehaviourStep {
  const step = stepEncounter({ object, tuning }, state, {
    at,
    seconds,
    target: bird,
    world: behaviourWorld(geometry),
  });
  const escaped = step.events.find(
    (event) => event.kind === "escaped" && event.cause === "distance",
  );
  return {
    actions: step.events.flatMap((event) => (event.kind === "action" ? [event.action] : [])),
    at: step.at,
    ...(escaped?.kind === "escaped" && escaped.cause === "distance" && { escaped: escaped.bark }),
    segments: step.segments,
    state: step.state,
  };
}
