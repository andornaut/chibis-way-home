import {
  type BehaviourChoiceObservation,
  type BehaviourFact,
  type BehaviourObservation,
  type BehaviourObserver,
  type BehaviourObserverFailure,
  type BehaviourPursuitObservation,
  type BehaviourWorkMetric,
  createBehaviourObserver,
} from "../rules/behaviourObserver.ts";

export interface BehaviourObservationReport {
  readonly diagnostics: {
    readonly deliveryFailures: readonly BehaviourObserverFailure[];
    readonly recordedEvents: number;
  };
  readonly lastChoice?: BehaviourChoiceObservation;
  readonly lastPursuit?: BehaviourPursuitObservation;
  readonly observations?: readonly BehaviourObservation[];
  readonly work: Readonly<Record<BehaviourWorkMetric, BehaviourFact<number>>>;
}

export interface BehaviourObservations {
  readonly observer: BehaviourObserver;
  readonly report: () => BehaviourObservationReport;
}

// Work counts only received events. Missing instrumentation never becomes a measured zero.
// This report makes no functional, challenge or playability conclusion.
export function createBehaviourObservations({
  retain = false,
}: { readonly retain?: boolean } = {}): BehaviourObservations {
  const observations = retain ? ([] as BehaviourObservation[]) : undefined;
  const work = new Map<BehaviourWorkMetric, number>();
  let recordedEvents = 0;
  let lastChoice: BehaviourChoiceObservation | undefined;
  let lastPursuit: BehaviourPursuitObservation | undefined;
  const observer = createBehaviourObserver((observation) => {
    if (observation.kind === "work") {
      if (!Number.isSafeInteger(observation.amount) || observation.amount < 0) {
        throw new Error("Behaviour work amount must be a nonnegative safe integer");
      }
      const amount = (work.get(observation.metric) ?? 0) + observation.amount;
      if (!Number.isSafeInteger(amount)) {
        throw new Error("Behaviour work total exceeds a safe integer");
      }
      work.set(observation.metric, amount);
    } else if (observation.kind === "pursuit") {
      lastPursuit = observation;
    } else {
      lastChoice = observation;
    }
    recordedEvents++;
    observations?.push(observation);
  });
  const count = (metric: BehaviourWorkMetric): BehaviourFact<number> =>
    work.has(metric)
      ? Object.freeze({ status: "captured", value: work.get(metric)! })
      : Object.freeze({ status: "not_evaluated" });
  return {
    observer,
    report: () =>
      Object.freeze({
        diagnostics: Object.freeze({ deliveryFailures: observer.failures(), recordedEvents }),
        ...(lastChoice && { lastChoice }),
        ...(lastPursuit && { lastPursuit }),
        ...(observations && { observations: Object.freeze([...observations]) }),
        work: Object.freeze({
          map_search_calls: count("map_search_calls"),
          route_cache_hits: count("route_cache_hits"),
          simulation_ticks: count("simulation_ticks"),
          transitions: count("transitions"),
          traversal_search_calls: count("traversal_search_calls"),
          traversal_states: count("traversal_states"),
          traversal_steps: count("traversal_steps"),
        }),
      }),
  };
}
