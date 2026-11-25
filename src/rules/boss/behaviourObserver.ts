import type { ScoreDecision } from "@andornaut/game-kit/runtime/ai/utility";

import type { Point, Rect } from "../../data/types/index.ts";
import type { AttackGateRefusal } from "./attackGate.ts";
import type {
  BehaviourScorerState,
  BossScorerChoice,
  BossScorerValues,
} from "./behaviourScorer.ts";
import type { BehaviourTraversalState } from "./behaviourTraversal.ts";

export type BehaviourFact<Value> =
  | { readonly status: "captured"; readonly value: Value }
  | { readonly reason?: string; readonly status: "unknown" }
  | { readonly status: "not_evaluated" };

export interface BehaviourObservationMetadata {
  readonly area?: string;
  readonly attempt?: number;
  readonly objectIndex?: number;
  readonly slice?: number;
  readonly tick?: number;
}

interface BehaviourObservationBase {
  readonly metadata?: BehaviourObservationMetadata;
}

export interface BehaviourPursuitObservation extends BehaviourObservationBase {
  readonly at: Point;
  readonly from: string;
  readonly grace: BehaviourFact<{
    readonly reachable: BehaviourFact<boolean>;
    readonly unreachableSeconds: number;
  }>;
  readonly kind: "pursuit";
  readonly scorer: BehaviourFact<
    Pick<
      BehaviourScorerState,
      | "chaseSeconds"
      | "heldSeconds"
      | "move"
      | "pressureSeconds"
      | "sinceAttackSeconds"
      | "sincePauseSeconds"
      | "specialDueSeconds"
      | "threatSeconds"
    >
  >;
  readonly target: BehaviourFact<Rect>;
  readonly to: string;
  readonly traversal: BehaviourFact<{
    readonly preparing: boolean;
    readonly status: BehaviourTraversalState["status"];
    readonly target: Rect;
  }>;
}

export type BehaviourWorkMetric =
  | "map_search_calls"
  | "route_cache_hits"
  | "simulation_ticks"
  | "transitions"
  | "traversal_search_calls"
  | "traversal_states"
  | "traversal_steps";

export interface BehaviourChoiceObservation extends BehaviourObservationBase {
  readonly action?: string;
  readonly choice: BossScorerChoice["kind"];
  readonly kind: "choice";
  readonly scoring: {
    readonly decision: ScoreDecision<string>;
    readonly sampledHoldSeconds: number;
    readonly streamKey: string;
    readonly values: BossScorerValues;
  };
  readonly state: string;
}

// A scored attack or a transition into a tell that the attack gate refused. Admissions are not
// recorded: the attack itself shows them.
export interface BehaviourGateObservation extends BehaviourObservationBase {
  readonly kind: "gate";
  readonly reason: AttackGateRefusal;
  readonly state: string;
  readonly to: string;
}

export interface BehaviourWorkObservation extends BehaviourObservationBase {
  readonly amount: number;
  readonly kind: "work";
  readonly metric: BehaviourWorkMetric;
}

export type BehaviourObservation =
  | BehaviourChoiceObservation
  | BehaviourGateObservation
  | BehaviourPursuitObservation
  | BehaviourWorkObservation;

export interface BehaviourObserverFailure {
  readonly eventKind: BehaviourObservation["kind"];
  readonly message: string;
  readonly metadata?: BehaviourObservationMetadata;
}

export interface BehaviourObserver {
  readonly failures: () => readonly BehaviourObserverFailure[];
  readonly record: (observation: BehaviourObservation) => void;
}

// A transient adapter can supply metadata it already has; rules need no new object or tick IDs.
export interface BehaviourObservationContext {
  readonly metadata?: BehaviourObservationMetadata;
  readonly observer: BehaviourObserver;
}

function copyFact<Value>(
  copy: (value: Value) => Value,
  fact: BehaviourFact<Value>,
): BehaviourFact<Value> {
  return Object.freeze(
    fact.status === "captured" ? { status: fact.status, value: copy(fact.value) } : { ...fact },
  );
}

function copyRect(rect: Rect): Rect {
  return Object.freeze({ height: rect.height, width: rect.width, x: rect.x, y: rect.y });
}

function copyMetadata(metadata: BehaviourObservationMetadata): BehaviourObservationMetadata {
  return Object.freeze({ ...metadata });
}

// Copies only the narrow diagnostic payload, never a live behaviour state, map or world.
function copyObservation(observation: BehaviourObservation): BehaviourObservation {
  const metadata = observation.metadata && copyMetadata(observation.metadata);
  if (observation.kind === "work") {
    return Object.freeze({
      amount: observation.amount,
      kind: observation.kind,
      ...(metadata && { metadata }),
      metric: observation.metric,
    });
  }
  if (observation.kind === "gate") {
    return Object.freeze({
      kind: observation.kind,
      ...(metadata && { metadata }),
      reason: observation.reason,
      state: observation.state,
      to: observation.to,
    });
  }
  if (observation.kind === "choice") {
    const { scoring } = observation;
    const { decision } = scoring;
    return Object.freeze({
      ...(observation.action !== undefined && { action: observation.action }),
      choice: observation.choice,
      kind: observation.kind,
      ...(metadata && { metadata }),
      scoring: Object.freeze({
        decision: Object.freeze({
          action: decision.action,
          reason: decision.reason,
          scores: Object.freeze(decision.scores.map((score) => Object.freeze({ ...score }))),
        }),
        sampledHoldSeconds: scoring.sampledHoldSeconds,
        streamKey: scoring.streamKey,
        values: Object.freeze({ ...scoring.values }),
      }),
      state: observation.state,
    });
  }
  return Object.freeze({
    at: Object.freeze({ x: observation.at.x, y: observation.at.y }),
    from: observation.from,
    grace: copyFact(
      (value) =>
        Object.freeze({
          reachable: copyFact((reachable) => reachable, value.reachable),
          unreachableSeconds: value.unreachableSeconds,
        }),
      observation.grace,
    ),
    kind: observation.kind,
    ...(metadata && { metadata }),
    scorer: copyFact((value) => Object.freeze({ ...value }), observation.scorer),
    target: copyFact(copyRect, observation.target),
    to: observation.to,
    traversal: copyFact(
      (value) =>
        Object.freeze({
          preparing: value.preparing,
          status: value.status,
          target: copyRect(value.target),
        }),
      observation.traversal,
    ),
  });
}

// Callers guard payload construction with their optional context. Nothing runs when absent.
export function createBehaviourObserver(
  receive: (observation: BehaviourObservation) => void,
): BehaviourObserver {
  const failures: BehaviourObserverFailure[] = [];
  return {
    failures: () => Object.freeze([...failures]),
    record: (observation) => {
      try {
        receive(copyObservation(observation));
      } catch (error) {
        failures.push(
          Object.freeze({
            eventKind: observation.kind,
            message:
              error instanceof Error
                ? error.message
                : typeof error === "string"
                  ? error
                  : "Behaviour observer delivery failed",
            ...(observation.metadata && { metadata: copyMetadata(observation.metadata) }),
          }),
        );
      }
    },
  };
}

export function recordBehaviourWork(
  observation: BehaviourObservationContext | undefined,
  metric: BehaviourWorkMetric,
  amount: number,
): void {
  if (observation) {
    observation.observer.record({
      amount,
      kind: "work",
      ...(observation.metadata && { metadata: observation.metadata }),
      metric,
    });
  }
}
