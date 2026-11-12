import { describe, expect, it } from "vitest";

import { ARCHETYPES } from "../data/archetypes.ts";
import { FERRET_BEHAVIOUR, GOOSE_BEHAVIOUR, PIGEON_BEHAVIOUR } from "../data/behaviours.ts";
import { TILE } from "../data/screen.ts";
import type { BehaviourAction, BehaviourPlan, ObjectLayout } from "../data/types/index.ts";
import { layoutBehaviour } from "../rules/behaviour.ts";
import { objectLayout } from "../rules/tiles.ts";
import type { Transient } from "../rules/transients.ts";
import {
  observeProjectiles,
  projectileGravityModels,
  type ProjectileObservationContext,
} from "./evadeProjectiles.ts";

const PUBLIC_MODELS = [
  { behaviour: FERRET_BEHAVIOUR, character: "ferret-parcel" },
  { behaviour: GOOSE_BEHAVIOUR, character: "goose-trap" },
  { behaviour: PIGEON_BEHAVIOUR, character: "pigeon-poop" },
] as const;
const emitters = PUBLIC_MODELS.map(({ behaviour }) => ({
  behaviour: layoutBehaviour(TILE, behaviour),
}));
const models = projectileGravityModels(emitters);
const template: ObjectLayout = objectLayout(
  1,
  {
    archetypes: ARCHETYPES,
    characters: { projectile: { archetype: "hazard", art: "projectile", cols: 10, rows: 10 } },
  },
  {},
  undefined,
  {},
  { character: "projectile", col: 0, row: 0 },
);
const context: ProjectileObservationContext = {
  gravityByEmitter: models,
  observer: { height: 10, width: 10, x: 10, y: 10 },
  world: { solids: [], view: { height: 300, width: 300, x: 0, y: 0 } },
};
const entity = (overrides: Partial<Transient> = {}): Transient => ({
  age: 1,
  armSeconds: 0,
  at: { x: 100, y: 10 },
  emitter: 0,
  gravity: NaN,
  id: 7,
  lifeSeconds: 10,
  object: { ...template, character: PUBLIC_MODELS[0].character },
  velocity: { x: -30, y: 20 },
  ...overrides,
});
const spawnOf = (plan: BehaviourPlan, character: string) =>
  Object.values(plan.states)
    .flatMap(({ onEnter }) => onEnter ?? [])
    .find(
      (action): action is Extract<BehaviourAction, { kind: "spawn" }> =>
        action.kind === "spawn" && action.character === character,
    )!;

it.each(PUBLIC_MODELS)(
  "observes $character with its public resolved model, never live gravity",
  ({ behaviour, character }) => {
    const emitter = PUBLIC_MODELS.findIndex((candidate) => candidate.character === character);
    const source = entity({ emitter, object: { ...template, character } });
    Object.defineProperty(source, "gravity", {
      get: () => {
        throw new Error("Live gravity must not be read");
      },
    });
    expect(observeProjectiles(context, [source])).toEqual({
      kind: "known",
      projectiles: [
        {
          emitter,
          gravity: spawnOf(behaviour, character).gravity * TILE,
          id: source.id,
          rect: { height: template.height, width: template.width, ...source.at },
          velocity: source.velocity,
        },
      ],
    });
  },
);

it("captures detached hitbox and motion snapshots, retaining independent projectile ids", () => {
  const at = { x: 100, y: 10 };
  const velocity = { x: -30, y: 20 };
  const hitbox = { height: 4, width: 6, x: 2, y: 3 };
  const source = entity({
    at,
    object: { ...template, character: PUBLIC_MODELS[0].character, hitbox },
    velocity,
  });
  const observation = observeProjectiles(context, [source, entity({ id: 8 })]);
  expect(observation.kind).toBe("known");
  if (observation.kind !== "known") {
    throw new Error(observation.problem);
  }
  const [first, second] = observation.projectiles;
  expect(first?.rect).toEqual({ height: 4, width: 6, x: 102, y: 13 });
  expect([first?.id, second?.id]).toEqual([7, 8]);
  at.x = 250;
  velocity.x = 90;
  hitbox.width = 30;
  expect(first?.rect).toEqual({ height: 4, width: 6, x: 102, y: 13 });
  expect(first?.velocity).toEqual({ x: -30, y: 20 });
});

it("does not add a collision-class exclusion to armed runtime transients", () => {
  const source = entity({
    object: { ...template, character: PUBLIC_MODELS[0].character, collision: "none" },
  });
  expect(observeProjectiles(context, [source])).toMatchObject({
    kind: "known",
    projectiles: [{ id: source.id }],
  });
});

describe("current visible lethal transients", () => {
  it.each([
    { label: "unarmed", source: entity({ age: 0.5, armSeconds: 1 }), world: context.world },
    { label: "offscreen centre", source: entity({ at: { x: 301, y: 10 } }), world: context.world },
    {
      label: "occluded",
      source: entity(),
      world: { ...context.world, solids: [{ height: 30, width: 10, x: 50, y: 0 }] },
    },
    {
      label: "observer outside view",
      source: entity(),
      world: { solids: [], view: { height: 100, width: 200, x: 50, y: 0 } },
    },
  ])("omits $label", ({ source, world }) => {
    expect(observeProjectiles({ ...context, world }, [source])).toEqual({
      kind: "known",
      projectiles: [],
    });
  });

  it.each(["ledge", "solid"] as const)("uses existing %s platform visibility", (collision) => {
    const world = {
      ...context.world,
      platforms: [{ collision, owner: template, rect: { height: 30, width: 10, x: 50, y: 0 } }],
    };
    const observation = observeProjectiles({ ...context, world }, [entity()]);
    expect(observation.kind).toBe("known");
    if (observation.kind !== "known") {
      throw new Error(observation.problem);
    }
    expect(observation.projectiles).toHaveLength(collision === "solid" ? 0 : 1);
  });

  it("observes a trap at its arming boundary without exposing the clock", () => {
    const source = entity({ age: 1, armSeconds: 1 });
    const observation = observeProjectiles(context, [source]);
    expect(observation).toMatchObject({ kind: "known", projectiles: [{ id: source.id }] });
    if (observation.kind !== "known") {
      throw new Error(observation.problem);
    }
    expect(Object.keys(observation.projectiles[0]!).sort()).toEqual([
      "emitter",
      "gravity",
      "id",
      "rect",
      "velocity",
    ]);
  });
});

it("reports missing visible public models, while hidden unknowns reveal nothing", () => {
  const source = entity({ emitter: emitters.length });
  expect(observeProjectiles(context, [source])).toMatchObject({ kind: "unknown" });
  expect(observeProjectiles(context, [source, entity({ age: 0, armSeconds: 1 })])).toMatchObject({
    kind: "unknown",
  });
  expect(observeProjectiles(context, [{ ...source, age: 0, armSeconds: 1 }])).toEqual({
    kind: "known",
    projectiles: [],
  });
  expect(observeProjectiles(context, [{ ...source, at: { x: 301, y: 10 } }])).toEqual({
    kind: "known",
    projectiles: [],
  });
});

it("preserves ambiguity across public states without choosing the live attack's model", () => {
  const original = emitters[0]!.behaviour;
  const action = spawnOf(original, PUBLIC_MODELS[0].character);
  const conflicting: BehaviourPlan = {
    ...original,
    states: {
      ...original.states,
      alternative: {
        ...original.states[original.initial]!,
        onEnter: [{ ...action, gravity: action.gravity + TILE }],
      },
    },
  };
  const gravityByEmitter = projectileGravityModels([{ behaviour: conflicting }]);
  expect(observeProjectiles({ ...context, gravityByEmitter }, [entity()])).toMatchObject({
    kind: "unknown",
  });
  expect(
    observeProjectiles({ ...context, gravityByEmitter }, [entity({ at: { x: 301, y: 10 } })]),
  ).toEqual({ kind: "known", projectiles: [] });
});
