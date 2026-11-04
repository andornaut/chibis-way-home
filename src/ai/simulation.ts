import { canonicalTrace, traceRecorder } from "./trace";

// A deterministic fixed-step world. Its randomness lives in its state, seeded by the caller, so a
// run never reads ambient entropy or wall-clock time.
export interface SimulationModel<State, Input, Tick> {
  // Prepares a state before its tick's input is chosen, such as starting the next episode.
  readonly begin: (state: State) => State;
  // A state that ends the run; checked after begin, before each step.
  readonly finished: (state: State) => boolean;
  // The structured record of one completed step.
  readonly sample: (tick: number, before: State, after: State) => Tick;
  readonly step: (seconds: number, input: Input, state: State) => State;
}

// Chooses one tick's input. A controller that draws randomness owns its own seeded stream.
export type SimulationController<State, Input> = (tick: number, state: State) => Input;

export interface SimulationClock {
  readonly maxTicks: number;
  readonly stepSeconds: number;
}

export interface SimulationRun<State, Tick> {
  // FNV-1a 64 over each tick's canonical form, with the tick count.
  readonly hash: string;
  readonly state: State;
  readonly ticks: readonly Tick[];
}

// Steps the model at the fixed clock until it finishes or the tick budget runs out. Equal
// models, controllers and start states give equal ticks and hashes.
export function simulate<State, Input, Tick>(
  clock: SimulationClock,
  model: SimulationModel<State, Input, Tick>,
  controller: SimulationController<State, Input>,
  start: State,
): SimulationRun<State, Tick> {
  const recorder = traceRecorder({ retain: false });
  const ticks: Tick[] = [];
  let state = start;
  for (let tick = 0; tick < clock.maxTicks; tick++) {
    state = model.begin(state);
    if (model.finished(state)) {
      break;
    }
    const before = state;
    state = model.step(clock.stepSeconds, controller(tick, before), before);
    const sample = model.sample(tick, before, state);
    recorder.record(canonicalTrace(() => undefined, sample));
    ticks.push(sample);
  }
  return { hash: recorder.hash(), state, ticks };
}
