import type { RandomStreams } from "../ai/randomStreams.ts";
import type { BirdTuning, DialogueLine, ObjectLayout, Point } from "../data/types/index.ts";
import {
  actBehaviour,
  type BehaviourEvent,
  type BehaviourState,
  type BehaviourStep,
  keepClear,
  stampPreparation,
} from "./behaviour.ts";
import type { BehaviourObservationContext } from "./behaviourObserver.ts";
import type { BehaviourPerception } from "./behaviourPerception.ts";
import {
  type BehaviourGeometry,
  type BehaviourWorld,
  behaviourWorld,
  type SupportSampler,
} from "./behaviourReach.ts";
import { contactBox } from "./behaviourTrack.ts";
import { birdBox, type BirdState } from "./bird.ts";
import { defeatBoss, holdDefeated } from "./bossDefeat.ts";
import type { PursuitGroundMap } from "./movementMaps.ts";
import { targetVisible } from "./perception.ts";

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
  // The sampler of the supports' later frames, for an object whose world holds a traversal frame.
  // It answers on demand, because the queried intervals follow from the object's own search.
  readonly supports?: SupportSampler | undefined;
  // The tuning that sizes Chibi's body.
  readonly tuning: BirdTuning;
}

// What one tick hands the object: its position, the step length, Chibi and the world it perceives.
export interface EncounterInput {
  readonly at: Point;
  readonly seconds: number;
  readonly target: BirdState;
  // Its spotted line has not been said this attempt.
  readonly unspotted?: true;
  readonly world: BehaviourWorld;
}

// What happened to the object on one step, in order. The caller applies them; the step itself
// changes nothing outside its result.
export type EncounterEvent =
  // An entry action, which the zone turns into a force pulse or a spawn.
  | { readonly action: BehaviourEvent; readonly kind: "action" }
  // It died on a red hazard or below the level.
  | { readonly cause: "fall" | "hazard"; readonly kind: "defeated" }
  // Its pursuit ended by distance or a give-up, with its escape line.
  | { readonly bark: DialogueLine; readonly cause: "distance"; readonly kind: "escaped" }
  // Its engaged pursuit ended because Chibi left through a room door.
  | { readonly cause: "door"; readonly kind: "escaped" }
  // It saw Chibi for the first time this attempt, with its spotted line.
  | { readonly bark: DialogueLine; readonly kind: "spotted" };

export interface EncounterStep {
  readonly at: Point;
  readonly events: readonly EncounterEvent[];
  readonly segments: BehaviourStep["segments"];
  readonly state: BehaviourState;
}

// What a tick decides about the object from every object's finished step, so it follows the step
// instead of entering it: the death test reads where the step left the object and the other
// hazards, and the door test where it left the doors.
export interface EncounterOutcome {
  // Chibi left the area through a room door.
  readonly door?: true;
  // The object died this step.
  readonly killedBy?: "fall" | "hazard";
}

// The state and events of one object's step, which the tick's outcome settles.
export type EncounterResult = Pick<EncounterStep, "events" | "state">;

// One fixed step of one behaviour-driven object. Pure: it reads only its arguments, so equal
// arguments replay an equal step. Its stages run in this order:
// 1. spot: an active, living object with an unsaid spotted line says it on a clear line of sight
//    from where the step starts.
// 2. hold: a dead boss holds still while its removal plays, and stages 3 to 6 are skipped.
// 3. perceive: one snapshot of Chibi and the world, with the context's map, streams and observer.
// 4. act: the pursuit update, recovery, then decide and act slices through the ability table.
// 5. keep clear: after an ended chase, movement toward Chibi within the escape distance is
//    cancelled.
// 6. stamp preparation: a takeoff preparation records its start once.
// 7. events: the spotted line, the entry actions and a distance escape, in order.
export function stepEncounter(
  context: EncounterContext,
  state: BehaviourState,
  input: EncounterInput,
): EncounterStep {
  const { object, tuning } = context;
  const { at, target, world } = input;
  const bark = object.behaviour?.spotted;
  const spotted =
    input.unspotted &&
    bark &&
    state.active &&
    !state.defeat &&
    targetVisible(
      world,
      object,
      contactBox(object, at, state.facing, state.axis),
      birdBox(tuning, target),
    );
  const step = moveEncounter(context, state, input);
  const events: EncounterEvent[] = spotted ? [{ bark, kind: "spotted" }] : [];
  for (const action of step.actions) {
    events.push({ action, kind: "action" });
  }
  if (step.escaped) {
    events.push({ bark: step.escaped, cause: "distance", kind: "escaped" });
  }
  return { at: step.at, events, segments: step.segments, state: step.state };
}

// Stages 2 to 6: the step before its outcomes become events.
function moveEncounter(
  context: EncounterContext,
  state: BehaviourState,
  input: EncounterInput,
): BehaviourStep {
  const { groundMap, object, observation, streams, supports, tuning } = context;
  const { at, seconds, target } = input;
  if (state.defeat) {
    return holdDefeated(seconds, at, state);
  }
  const frame = input.world.traversalFrame;
  const world: BehaviourWorld = {
    ...input.world,
    ...(frame && supports && { traversalFrame: { ...frame, sample: supports } }),
    ...(groundMap && { groundMap }),
    ...(streams && { decisions: streams }),
    ...(observation && { observation }),
  };
  const perception: BehaviourPerception = { target, tuning, world };
  const acted = actBehaviour(perception, object, seconds, at, state);
  const clear = keepClear(perception, object, at, acted);
  return stampPreparation(clear);
}

// Fixtures that hold their own geometry read the step before its outcomes become events, without
// a map, streams or observer of the context.
export function stepBehaviour(
  tuning: BirdTuning,
  object: ObjectLayout,
  geometry: BehaviourGeometry,
  seconds: number,
  bird: BirdState,
  at: Point,
  state: BehaviourState,
): BehaviourStep {
  return moveEncounter({ object, tuning }, state, {
    at,
    seconds,
    target: bird,
    world: behaviourWorld(geometry),
  });
}

// Applies the tick's outcome to a stepped object. A death ends its pursuit without an escape and
// starts its removal; a door ends an engaged pursuit as an escape without a bark. An outcome that
// does not apply returns the result unchanged.
export function settleEncounter(
  outcome: EncounterOutcome,
  result: EncounterResult,
): EncounterResult {
  let { events, state } = result;
  if (outcome.killedBy) {
    events = [
      ...events.filter(({ kind }) => kind !== "escaped"),
      { cause: outcome.killedBy, kind: "defeated" },
    ];
    state = defeatBoss(state);
  }
  if (outcome.door && state.pursuit?.phase === "engaged") {
    events = [...events, { cause: "door", kind: "escaped" }];
    state = {
      ...state,
      pursuit: { ...state.pursuit, home: true, phase: "escaped", settled: false },
    };
  }
  return events === result.events ? result : { events, state };
}
