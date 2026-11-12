import { expect, it } from "vitest";

import { abilityFor, type AbilityTable } from "./ability.ts";

type Params =
  | { readonly kind: "step"; readonly distance: number }
  | { readonly kind: "turn" }
  | { readonly kind: "wait" };
interface Agent {
  readonly facing: -1 | 1;
  readonly x: number;
}

// A synthetic agent whose table registers two of its three parameter kinds.
const TABLE: AbilityTable<{ readonly scale: number }, Params, Agent, Agent> = {
  step: {
    act: ({ scale }, { distance }, agent) => ({
      ...agent,
      x: agent.x + agent.facing * distance * scale,
    }),
  },
  turn: { act: (_, __, agent) => ({ ...agent, facing: agent.facing === 1 ? -1 : 1 }) },
};

it("dispatches each kind through its explicit table entry and leaves unregistered kinds", () => {
  const agent: Agent = { facing: 1, x: 0 };
  const plan: Params[] = [
    { distance: 2, kind: "step" },
    { kind: "turn" },
    { distance: 1, kind: "step" },
  ];
  const end = plan.reduce((current, params) => {
    const ability = abilityFor(TABLE, params);
    return ability ? ability.act({ scale: 0.5 }, params, current) : current;
  }, agent);
  expect(end).toEqual({ facing: -1, x: 0.5 });
  expect(abilityFor(TABLE, { kind: "wait" })).toBeUndefined();
  expect(agent).toEqual({ facing: 1, x: 0 });
});
