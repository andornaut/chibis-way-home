import {
  type BehaviourObservationReport,
  createBehaviourObservations,
} from "./behaviourObservations.ts";
import { type EvadeContext, type EvadeRun, evadeRun, type EvadeStart } from "./evade.ts";

export interface ObservedEvadeRun {
  readonly episodes: {
    readonly boss: BehaviourObservationReport;
    readonly free: BehaviourObservationReport;
  };
  readonly run: EvadeRun;
}

export function observedEvadeRun(
  context: Omit<EvadeContext, "observers">,
  start: EvadeStart,
  seed: number,
): ObservedEvadeRun {
  const boss = createBehaviourObservations();
  const free = createBehaviourObservations();
  const run = evadeRun(
    { ...context, observers: { boss: boss.observer, free: free.observer } },
    start,
    seed,
  );
  return { episodes: { boss: boss.report(), free: free.report() }, run };
}
