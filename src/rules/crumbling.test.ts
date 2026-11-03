import type { CrumblingDefinition } from "@andornaut/game-kit/terrain/crumbling";
import { stepTraversal, type TraversalAvailability } from "@andornaut/game-kit/terrain/traversal";
import { describe, expect, it } from "vitest";

import type { Archetype, CrumblingSupportId, Rect } from "../data/types";
import {
  type CrumblingActor,
  type CrumblingAdapterContext,
  type CrumblingQueryWorld,
  crumblingTraversalAdapter,
  initialCrumblingWorld,
} from "./crumbling";
import { areaLayout, objectLayout } from "./tiles";

const profile = { absentSeconds: 2, warningSeconds: 0.8 };
const archetype: Archetype = {
  collision: "solid",
  interaction: { kind: "none", range: 0 },
  motion: {
    algorithm: "static",
    direction: "right",
    distance: 0,
    hopHeight: 0,
    pause: 0,
    speed: 0,
    variance: 0,
  },
  reaction: { kind: "none", range: 0, speed: 0 },
};
const catalogue = {
  archetypes: { support: archetype },
  characters: { support: { archetype: "support", art: "fixture", cols: 3, rows: 2 } },
};
const instance = { character: "support", col: 4, row: 8 };
const plan = {
  cols: 60,
  entries: { start: { col: 1, row: 8 } },
  objects: [instance],
  rows: 60,
  solids: [{ col: 0, cols: 10, row: 10, rows: 3 }],
};

describe("crumbling authoring boundary", () => {
  it("rejects hidden terrain underlays but allows touching edges and independent object skins", () => {
    const marked = { ...plan.solids[0]!, crumbling: profile };
    expect(() =>
      areaLayout(12, catalogue, {}, {}, new Set(), {
        ...plan,
        solids: [marked, { ...plan.solids[0]!, row: marked.row + 1 }],
      }),
    ).toThrow("must not overlap another terrain collider");
    expect(() =>
      areaLayout(12, catalogue, {}, {}, new Set(), {
        ...plan,
        solids: [marked, { ...plan.solids[0]!, col: marked.col + marked.cols }],
      }),
    ).not.toThrow();
    const objectUnderlay = areaLayout(12, catalogue, {}, {}, new Set(), {
      ...plan,
      objects: [{ ...instance, crumbling: profile, row: marked.row }],
    });
    expect(objectUnderlay.crumbling![0]!.supportId).toBe(objectUnderlay.objects[0]);
  });

  it("preserves omitted metadata and binds terrain and object definitions to actual collider identities", () => {
    const plain = areaLayout(12, catalogue, {}, {}, new Set(), plan);
    expect(plain).not.toHaveProperty("crumbling");
    expect(plain.objects[0]).not.toHaveProperty("crumbling");
    const marked = areaLayout(12, catalogue, {}, {}, new Set(), {
      ...plan,
      objects: [{ ...instance, crumbling: profile }],
      solids: [{ ...plan.solids[0]!, crumbling: profile }],
    });
    expect(marked.crumbling).toHaveLength(2);
    expect(marked.crumbling![0]!.supportId).toBe(marked.solids[0]);
    expect(marked.crumbling![0]!.volume).toEqual({ height: 36, width: 120, x: 0, y: 120 });
    expect(marked.crumbling![1]!.supportId).toBe(marked.objects[0]);
    expect(marked.crumbling![1]!.volume).toEqual({ height: 24, width: 36, x: 48, y: 96 });
    expect(marked.crumbling!.map(({ profile: value }) => value)).toEqual([profile, profile]);
    expect(marked.solids).toEqual(plain.solids);
  });

  it.each(["solid", "ledge"] as const)("retains stationary %s support metadata", (collision) => {
    const object = objectLayout(
      12,
      { ...catalogue, archetypes: { support: { ...archetype, collision } } },
      {},
      undefined,
      {},
      { ...instance, crumbling: profile },
    );
    expect(object.crumbling).toBe(profile);
    expect(object.collision).toBe(collision);
  });

  it.each([
    { absentSeconds: 0, warningSeconds: 0.8 },
    { absentSeconds: 2, warningSeconds: Infinity },
  ])("rejects invalid timing rather than substituting gameplay defaults: %j", (crumbling) => {
    expect(() =>
      areaLayout(12, catalogue, {}, {}, new Set(), {
        ...plan,
        solids: [{ ...plan.solids[0]!, crumbling }],
      }),
    ).toThrow("finite positive seconds");
  });

  it.each([
    { collision: "hazard" as const },
    { collision: "none" as const },
    { motion: { ...archetype.motion, algorithm: "linear" as const } },
    { reaction: { ...archetype.reaction, kind: "avoid" as const } },
  ])("rejects nonstationary or non-support archetypes: %j", (patch) => {
    expect(() =>
      objectLayout(
        12,
        { ...catalogue, archetypes: { support: { ...archetype, ...patch } } },
        {},
        undefined,
        {},
        { ...instance, crumbling: profile },
      ),
    ).toThrow("stationary physical support");
  });

  it("rejects behaviour, orbit and explicit motion/reaction overrides even when visually stationary", () => {
    const patches = [
      { overrides: { motion: { algorithm: "static" as const } } },
      { overrides: { reaction: { kind: "none" as const } } },
      { orbit: { angularSpeed: 1, host: "host", phase: 0, radius: 2 } },
      {
        behaviour: {
          axis: "x" as const,
          distance: 0,
          initial: "wait",
          states: { wait: { animation: null, motion: { kind: "wait" as const }, transitions: [] } },
        },
      },
    ];
    for (const patch of patches) {
      expect(() =>
        objectLayout(
          12,
          catalogue,
          {},
          undefined,
          {},
          { ...instance, crumbling: profile, ...patch },
        ),
      ).toThrow("stationary physical support");
    }
  });
});

const support: Rect = { height: 30, width: 60, x: 0, y: 100 };
const floor: Rect = { height: 20, width: 200, x: 0, y: 200 };
const body: Rect = { height: 20, width: 10, x: 10, y: 80 };
const definitions: readonly CrumblingDefinition<CrumblingSupportId>[] = [
  { profile, supportId: support, volume: support },
];
type OtherWorld = { readonly key: string; readonly actors: readonly CrumblingActor<string>[] };
type QueryWorld = CrumblingQueryWorld<string, OtherWorld>;
const root = (actors: readonly CrumblingActor<string>[] = []): QueryWorld => ({
  crumbling: initialCrumblingWorld(definitions),
  otherWorld: { actors, key: "actual-world-1" },
});
const context: CrumblingAdapterContext<string, OtherWorld> = {
  actorId: "chibi",
  definitions,
  identity: "main-query",
  otherActors: (world) => ({ status: "available", value: world.actors }),
  otherKey: (world) => world.key,
  safe: () => "safe",
  sampleColliders: () => ({
    colliders: [support, floor].map((rect) => ({
      after: rect,
      before: rect,
      kind: "solid",
      supportId: rect,
    })),
    complete: true,
  }),
};
const prepared = (value: TraversalAvailability<QueryWorld>): QueryWorld => {
  expect(value.status).toBe("available");
  if (value.status !== "available") {
    throw Error("Expected known query world");
  }
  return value.value;
};

describe("crumbling traversal boundary", () => {
  it("records contacts produced by the public physics step and preserves unknown-query rollback", () => {
    const adapter = crumblingTraversalAdapter(context);
    const initial = {
      fallFromY: body.y,
      grounded: true,
      supportId: support,
      vy: 0,
      world: root(),
      x: body.x,
      y: body.y,
    };
    const physical = {
      body: { height: body.height, offset: { x: 0, y: 0 }, width: body.width },
      bounds: { height: 300, width: 200, x: 0, y: 0 },
      dtSeconds: 0.1,
      epsilon: 1e-6,
      maxCollisionSteps: 20,
      maxDrop: 300,
      profile: { gravity: 100, jumpSpeed: 50, maxFallSpeed: 100, walkSpeed: 20 },
      world: adapter,
    };
    const input = { jump: false, move: 0 as const, timeSeconds: 0 };
    const result = stepTraversal(physical, input, initial);
    expect(result.status).toBe("ok");
    expect(result.state.world.crumbling.pendingContacts).toEqual([
      { actorId: "chibi", supportId: support },
    ]);
    expect(initial.world.crumbling.pendingContacts).toEqual([]);
    const unknown = crumblingTraversalAdapter({
      ...context,
      otherActors: () => ({ status: "unavailable" }),
    });
    const refused = stepTraversal({ ...physical, world: unknown }, input, initial);
    expect(refused.status).toBe("geometry-unavailable");
    expect(refused.state.world).toBe(initial.world);
  });

  it("queues all resolved physical actor contacts and filters only the absent support next tick", () => {
    const adapter = crumblingTraversalAdapter(context);
    const initial = root([{ actorId: "boss", body, standingSupportIds: [support] }]);
    const started = prepared(adapter.beginStep(initial, { body, dtSeconds: 0.1, timeSeconds: 0 }));
    const landed = prepared(
      adapter.endStep(started, { body, standingSupportIds: [floor], timeSeconds: 0.1 }),
    );
    expect(landed.crumbling.pendingContacts).toEqual([{ actorId: "boss", supportId: support }]);
    expect(initial.crumbling.pendingContacts).toEqual([]);
    const warning = prepared(adapter.beginStep(landed, { body, dtSeconds: 0.1, timeSeconds: 0.1 }));
    expect(warning.crumbling.supports[0]!.phase).toEqual({ kind: "warning", removeAtSeconds: 0.9 });
    expect(adapter.sampleColliders(warning, 0.1, 0.1, body).colliders).toHaveLength(2);
    const absent = prepared(adapter.beginStep(warning, { body, dtSeconds: 0.1, timeSeconds: 0.9 }));
    expect(
      adapter.sampleColliders(absent, 0.9, 0.1, body).colliders.map(({ supportId }) => supportId),
    ).toEqual([floor]);
  });

  it("uses full-volume other-actor occupancy and substitutes the hypothetical branch body", () => {
    const adapter = crumblingTraversalAdapter(context);
    const absent: QueryWorld = {
      ...root([
        { actorId: "chibi", body: support, standingSupportIds: [] },
        { actorId: "boss", body: { ...body, y: 120 }, standingSupportIds: [] },
      ]),
      crumbling: {
        ...initialCrumblingWorld(definitions),
        supports: [{ phase: { kind: "absent", restoreAfterSeconds: 2 }, supportId: support }],
      },
    };
    const occupied = prepared(adapter.beginStep(absent, { body, dtSeconds: 0.1, timeSeconds: 2 }));
    expect(occupied.crumbling.supports[0]!.phase.kind).toBe("absent");
    const clear = prepared(
      adapter.beginStep(
        {
          ...absent,
          otherWorld: { ...absent.otherWorld, actors: absent.otherWorld.actors.slice(0, 1) },
        },
        { body, dtSeconds: 0.1, timeSeconds: 2 },
      ),
    );
    expect(clear.crumbling.supports[0]!.phase.kind).toBe("intact");
    const branchInside = prepared(
      adapter.beginStep(
        { ...absent, otherWorld: { ...absent.otherWorld, actors: [] } },
        { body: support, dtSeconds: 0.1, timeSeconds: 2 },
      ),
    );
    expect(branchInside.crumbling.supports[0]!.phase.kind).toBe("absent");
  });

  it("propagates unknown actor futures and safety instead of assuming empty space", () => {
    const adapter = crumblingTraversalAdapter({
      ...context,
      otherActors: () => ({ status: "unavailable" }),
      safe: () => "unavailable",
    });
    expect(adapter.beginStep(root(), { body, dtSeconds: 0.1, timeSeconds: 0 })).toEqual({
      status: "unavailable",
    });
    expect(adapter.endStep(root(), { body, standingSupportIds: [], timeSeconds: 0.1 })).toEqual({
      status: "unavailable",
    });
    expect(
      adapter.safe(root(), {
        endSeconds: 0.1,
        from: body,
        phase: "sweep",
        startSeconds: 0,
        to: body,
      }),
    ).toBe("unavailable");
  });

  it("keys all phase and contact state using distinct support and external identities", () => {
    const twin = { ...support };
    const adapter = crumblingTraversalAdapter({
      ...context,
      definitions: [...definitions, { profile, supportId: twin, volume: twin }],
    });
    const original: QueryWorld = {
      ...root(),
      crumbling: initialCrumblingWorld([
        ...definitions,
        { profile, supportId: twin, volume: twin },
      ]),
    };
    const worlds: QueryWorld[] = [
      original,
      {
        ...original,
        crumbling: {
          ...original.crumbling,
          supports: [
            { phase: { kind: "absent", restoreAfterSeconds: 2 }, supportId: support },
            original.crumbling.supports[1]!,
          ],
        },
      },
      { ...original, otherWorld: { ...original.otherWorld, key: "another-world" } },
      { ...original, crumbling: { ...original.crumbling, begunAtSeconds: 0 } },
      {
        ...original,
        crumbling: {
          ...original.crumbling,
          pendingContacts: [{ actorId: "boss", supportId: support }],
        },
      },
      {
        ...original,
        crumbling: {
          ...original.crumbling,
          pendingContacts: [{ actorId: "boss", supportId: twin }],
        },
      },
      {
        ...original,
        crumbling: {
          ...original.crumbling,
          standingContacts: [{ actorId: "boss", supportId: support }],
        },
      },
      ...[1, 2].map((deadline): QueryWorld => ({
        ...original,
        crumbling: {
          ...original.crumbling,
          supports: [
            { phase: { kind: "warning", removeAtSeconds: deadline }, supportId: support },
            original.crumbling.supports[1]!,
          ],
        },
      })),
    ];
    const keys = worlds.map(adapter.key);
    expect(new Set(keys).size).toBe(worlds.length);
    expect(worlds.map(adapter.key)).toEqual(keys);
  });
});
