import type { RandomStreams } from "../ai/randomStreams.ts";
import type { BirdTuning, DialogueLine, ObjectLayout, Point } from "../data/types/index.ts";
import {
  advanceBehaviour,
  type BehaviourEvent,
  type BehaviourState,
  type BehaviourStep,
} from "./behaviour.ts";
import type { BehaviourObservationContext } from "./behaviourObserver.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import type { BirdState } from "./bird.ts";
import type { PursuitGroundMap } from "./movementMaps.ts";

// What the caller hands one behaviour-driven object besides the tick's input. The step reads no
// cache, clock or random source of its own.
export interface EncounterContext {
  // The object's ground pursuit map over the area's static terrain, when one is built.
  readonly groundMap?: PursuitGroundMap | undefined;
  readonly object: ObjectLayout;
  // Diagnostic recording; it never changes the step.
  readonly observation?: BehaviourObservationContext | undefined;
  // Object-local decision streams; equal keys replay equal draws.
  readonly streams?: RandomStreams | undefined;
  // The tuning that sizes Chibi's body.
  readonly tuning: BirdTuning;
}

// What one tick hands the object: its position, the step length, Chibi and the world it perceives.
export interface EncounterInput {
  readonly at: Point;
  readonly seconds: number;
  readonly target: BirdState;
  readonly world: BehaviourWorld;
}

// What happened to the object on one step, in order. The caller applies them; the step itself
// changes nothing outside its result.
export type EncounterEvent =
  // An entry action, which the zone turns into a force pulse or a spawn.
  | { readonly action: BehaviourEvent; readonly kind: "action" }
  // Its pursuit ended by distance or a give-up, with its escape line.
  | { readonly bark: DialogueLine; readonly cause: "distance"; readonly kind: "escaped" };

export interface EncounterStep extends BehaviourStep {
  readonly events: readonly EncounterEvent[];
}

// One fixed step of one behaviour-driven object: perceive, decide and act. Pure: it reads only
// its arguments, so equal arguments replay an equal step.
export function stepEncounter(
  context: EncounterContext,
  state: BehaviourState,
  input: EncounterInput,
): EncounterStep {
  const { groundMap, object, observation, streams, tuning } = context;
  const { at, seconds, target } = input;
  const world: BehaviourWorld = {
    ...input.world,
    ...(groundMap && { groundMap }),
    ...(streams && { decisions: streams }),
    ...(observation && { observation }),
  };
  const step = advanceBehaviour({ target, tuning, world }, object, seconds, at, state);
  const events: EncounterEvent[] = step.actions.map((action) => ({ action, kind: "action" }));
  if (step.escaped) {
    events.push({ bark: step.escaped, cause: "distance", kind: "escaped" });
  }
  return { ...step, events };
}
