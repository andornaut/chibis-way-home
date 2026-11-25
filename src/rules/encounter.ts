import type { BirdTuning, ObjectLayout, Point } from "../data/types/index.ts";
import { advanceBehaviour, type BehaviourState, type BehaviourStep } from "./behaviour.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import type { BirdState } from "./bird.ts";

// What stays fixed for one behaviour-driven object over a tick: its layout and the tuning that
// sizes Chibi's body.
export interface EncounterContext {
  readonly object: ObjectLayout;
  readonly tuning: BirdTuning;
}

// What one tick hands the object: its position, the step length, Chibi and the world it perceives.
export interface EncounterInput {
  readonly at: Point;
  readonly seconds: number;
  readonly target: BirdState;
  readonly world: BehaviourWorld;
}

// One fixed step of one behaviour-driven object: perceive, decide and act. Pure: it reads only
// its arguments, so equal arguments replay an equal step.
export function stepEncounter(
  context: EncounterContext,
  state: BehaviourState,
  input: EncounterInput,
): BehaviourStep {
  const { object, tuning } = context;
  const { at, seconds, target, world } = input;
  return advanceBehaviour({ target, tuning, world }, object, seconds, at, state);
}
