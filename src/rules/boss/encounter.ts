import type { RandomStreams } from "../../ai/index.ts";
import type { BirdTuning, DialogueLine, ObjectLayout, Point } from "../../data/types/index.ts";
import { birdBox, type BirdState } from "../bird/index.ts";
import {
  actBehaviour,
  type BehaviourEvent,
  type BehaviourState,
  type BehaviourStep,
  keepClear,
  stampPreparation,
  startBehaviour,
} from "./behaviour.ts";
import {
  type BehaviourObservation,
  type BehaviourObservationMetadata,
  createBehaviourObserver,
} from "./behaviourObserver.ts";
import type { BehaviourPerception } from "./behaviourPerception.ts";
import type { BehaviourWorld, SupportSampler } from "./behaviourReach.ts";
import { contactBox } from "./behaviourTrack.ts";
import { defeatBoss, holdDefeated, removedBoss } from "./bossDefeat.ts";
import type { PursuitGroundMap } from "./movementMaps.ts";
import { targetVisible } from "./perception.ts";

// What the caller hands one behaviour-driven object besides the tick's input. The step reads no
// cache, clock or random source of its own.
export interface EncounterContext {
  // The object's ground pursuit map over the area's static terrain, when one is built.
  readonly groundMap?: PursuitGroundMap | undefined;
  readonly object: ObjectLayout;
  // Requests the step's diagnostics, which return as its observations under this metadata. It
  // never changes the rest of the step.
  readonly observe?: BehaviourObservationMetadata | undefined;
  // Object-local decision streams; equal keys replay equal draws.
  readonly streams?: RandomStreams | undefined;
  // The sampler of the supports' later frames, for an object whose world holds a traversal frame.
  // It answers on demand, because the queried intervals follow from the object's own search.
  readonly supports?: SupportSampler | undefined;
  // The tuning that sizes Chibi's body.
  readonly tuning: BirdTuning;
}

// How an object's encounter begins when Chibi enters its area.
export interface EncounterEntry {
  // The boss died earlier in the attempt.
  readonly defeated?: true;
  readonly kind: "enter";
  readonly target: BirdState;
}

// What one tick hands the object: its position, the step length, Chibi and the world it perceives.
export interface EncounterTick {
  readonly at: Point;
  readonly kind: "tick";
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
  // The step's diagnostics in the order they arose, present only when the context requests them.
  readonly observations?: readonly BehaviourObservation[];
  readonly segments: BehaviourStep["segments"];
  readonly state: BehaviourState;
}

// What is decided about the object outside its step. A closed conversation activates it between
// ticks. A tick decides the rest from every object's finished step, so they follow the step
// instead of entering it: the death test reads where the step left the object and the other
// hazards, and the door test where it left the doors.
export interface EncounterOutcome {
  // Its conversation closed.
  readonly activated?: true;
  // Chibi left the area through a room door.
  readonly door?: true;
  // The object died this step.
  readonly killedBy?: "fall" | "hazard";
}

// The state and events of one object's step, which the tick's outcome settles.
export type EncounterResult = Pick<EncounterStep, "events" | "state">;

// What one call hands the object: its area entry, or a tick.
export type EncounterInput = EncounterEntry | EncounterTick;

// The one entry point of a behaviour-driven object. Pure: it reads only its arguments, so equal
// arguments replay an equal step.
//
// An entry starts the object at its origin in its plan's initial state, inactive while a
// conversation holds it; a boss that died earlier in the attempt enters already removed.
//
// A tick runs one fixed step from the state, in this order:
// 1. spot: an active, living object with an unsaid spotted line says it on a clear line of sight
//    from where the step starts.
// 2. hold: a dead boss holds still while its removal plays, and stages 3 to 6 are skipped.
// 3. perceive: one snapshot of Chibi and the world, with the context's map, streams and sampler.
// 4. act: the pursuit update, recovery, then decide and act slices through the ability table.
// 5. keep clear: after an ended chase, movement toward Chibi within the escape distance is
//    cancelled.
// 6. stamp preparation: a takeoff preparation records its start once.
// 7. events: the spotted line, the entry actions and a distance escape, in order.
// Requested diagnostics gather in a list of the call's own and return as `observations`.
export function stepEncounter(
  context: EncounterContext,
  state: undefined,
  input: EncounterEntry,
): EncounterStep;
export function stepEncounter(
  context: EncounterContext,
  state: BehaviourState,
  input: EncounterTick,
): EncounterStep;
export function stepEncounter(
  context: EncounterContext,
  state: BehaviourState | undefined,
  input: EncounterInput,
): EncounterStep {
  const { object, tuning } = context;
  if (input.kind === "enter") {
    const entered = startBehaviour(tuning, object, input.target);
    const start = input.defeated ? removedBoss(entered) : entered;
    return { at: object.origin, events: [], segments: [], state: start };
  }
  if (!state) {
    throw new Error("An encounter ticks only after its entry");
  }
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
  const observations: BehaviourObservation[] | undefined = context.observe && [];
  const step = moveEncounter(context, observations, state, input);
  const events: EncounterEvent[] = spotted ? [{ bark, kind: "spotted" }] : [];
  for (const action of step.actions) {
    events.push({ action, kind: "action" });
  }
  if (step.escaped) {
    events.push({ bark: step.escaped, cause: "distance", kind: "escaped" });
  }
  return {
    at: step.at,
    events,
    ...(observations && { observations }),
    segments: step.segments,
    state: step.state,
  };
}

// Stages 2 to 6: the step before its outcomes become events. Diagnostics append to the list.
function moveEncounter(
  context: EncounterContext,
  observations: BehaviourObservation[] | undefined,
  state: BehaviourState,
  input: EncounterTick,
): BehaviourStep {
  const { groundMap, object, observe, streams, supports, tuning } = context;
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
    ...(observations &&
      observe && {
        observation: {
          metadata: observe,
          observer: createBehaviourObserver((observation) => {
            observations.push(observation);
          }),
        },
      }),
  };
  const perception: BehaviourPerception = { target, tuning, world };
  const acted = actBehaviour(perception, object, seconds, at, state);
  const clear = keepClear(perception, object, at, acted);
  return stampPreparation(clear);
}

// The encounter step as a dependency of a module that samples it, such as a timed hazard's clock.
export type EncounterSampler = typeof stepEncounter;

// Applies an outcome to the object's state and events. Activation makes an inactive object active.
// A death ends its pursuit without an escape and starts its removal; a door ends an engaged
// pursuit as an escape without a bark. An outcome that does not apply returns the result
// unchanged.
export function settleEncounter(
  outcome: EncounterOutcome,
  result: EncounterResult,
): EncounterResult {
  let { events, state } = result;
  if (outcome.activated && !state.active) {
    state = { ...state, active: true };
  }
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
  return events === result.events && state === result.state ? result : { events, state };
}
