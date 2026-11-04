// An ability turns one decided parameter set into an agent's motion or effects for one step.
// Context carries the perception snapshot and step inputs; the agent is the subject.
export interface Ability<Context, Params, Agent, Result> {
  readonly act: (context: Context, params: Params, agent: Agent) => Result;
}

// What an ability produced for one step: the agent's next state, and any motion segments and
// effects for the caller to apply. A concrete agent extends it with its own step outputs.
export interface AbilityResult<State, Segment, Effect> {
  readonly effects?: readonly Effect[];
  readonly segments?: readonly Segment[];
  readonly state: State;
}

interface Kinded {
  readonly kind: string;
}

// An explicit table from parameter kind to ability, passed in as a value. A kind without an
// entry is left to the caller.
export type AbilityTable<Context, Params extends Kinded, Agent, Result> = {
  readonly [Kind in Params["kind"]]?: Ability<
    Context,
    Extract<Params, { readonly kind: Kind }>,
    Agent,
    Result
  >;
};

export function abilityFor<Context, Params extends Kinded, Agent, Result>(
  table: AbilityTable<Context, Params, Agent, Result>,
  params: Params,
): Ability<Context, Params, Agent, Result> | undefined {
  return table[params.kind as Params["kind"]] as
    Ability<Context, Params, Agent, Result> | undefined;
}
