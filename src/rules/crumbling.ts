import { rectsOverlap } from "@andornaut/game-kit/rect";
import {
  beginCrumblingStep,
  type CrumblingDefinition,
  type CrumblingProfile,
  type CrumblingWorld,
  endCrumblingStep,
} from "@andornaut/game-kit/terrain/crumbling";
import type {
  TraversalAvailability,
  TraversalContext,
  TraversalSafety,
  TraversalWorldAdapter,
  TraversalWorldSafety,
} from "@andornaut/game-kit/terrain/traversal";

import type { AreaLayout, CrumblingSupportId, Rect } from "../data/types";

export function validateCrumblingProfile(profile: CrumblingProfile): void {
  if (![profile.warningSeconds, profile.absentSeconds].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error("Crumbling durations must be finite positive seconds");
  }
}

export function crumblingDefinitions(
  area: AreaLayout,
): readonly CrumblingDefinition<CrumblingSupportId>[] {
  const definitions: CrumblingDefinition<CrumblingSupportId>[] = [];
  for (const [index, source] of area.terrain.entries()) {
    if (source.crumbling) {
      const supportId = area.solids[index]!;
      definitions.push({ profile: source.crumbling, supportId, volume: supportId });
    }
  }
  for (const object of area.objects) {
    if (object.crumbling) {
      definitions.push({
        profile: object.crumbling,
        supportId: object,
        volume: { ...object.origin, height: object.height, width: object.width },
      });
    }
  }
  for (const { profile, volume } of definitions) {
    validateCrumblingProfile(profile);
    if (
      !volume ||
      ![volume.x, volume.y, volume.width, volume.height].every(Number.isFinite) ||
      volume.width <= 0 ||
      volume.height <= 0
    ) {
      throw new Error("Crumbling support requires a finite positive collider volume");
    }
  }
  return definitions;
}

export function initialCrumblingWorld<ActorId>(
  definitions: readonly CrumblingDefinition<CrumblingSupportId>[],
): CrumblingWorld<CrumblingSupportId, ActorId> {
  return {
    begunAtSeconds: null,
    pendingContacts: [],
    standingContacts: [],
    supports: definitions.map(({ supportId }) => ({ phase: { kind: "intact" }, supportId })),
  };
}

export function crumblingSupportPresent<ActorId>(
  world: CrumblingWorld<CrumblingSupportId, ActorId>,
  supportId: CrumblingSupportId,
): boolean {
  return !world.supports.some(
    (support) => support.supportId === supportId && support.phase.kind === "absent",
  );
}

export interface CrumblingActor<ActorId> {
  readonly actorId: ActorId;
  readonly body: Rect;
  readonly standingSupportIds: readonly CrumblingSupportId[];
}

export interface CrumblingQueryWorld<ActorId, OtherWorld> {
  readonly crumbling: CrumblingWorld<CrumblingSupportId, ActorId>;
  readonly otherWorld: OtherWorld;
}

export interface CrumblingAdapterContext<ActorId, OtherWorld> {
  readonly actorId: ActorId;
  readonly definitions: readonly CrumblingDefinition<CrumblingSupportId>[];
  readonly identity: string;
  // The immutable other-world key must distinguish every branch-varying external state.
  readonly otherKey: (world: OtherWorld) => string;
  // Complete physical actor bodies and resolved contacts at this actual boundary, or unknown.
  readonly otherActors: (
    world: OtherWorld,
    timeSeconds: number,
  ) => TraversalAvailability<readonly CrumblingActor<ActorId>[]>;
  readonly sampleColliders: (
    world: OtherWorld,
    ...request: Parameters<TraversalContext<CrumblingSupportId>["sampleColliders"]>
  ) => ReturnType<TraversalContext<CrumblingSupportId>["sampleColliders"]>;
  readonly safe: (world: OtherWorld, request: TraversalSafety) => TraversalWorldSafety;
}

export function crumblingTraversalAdapter<ActorId, OtherWorld>(
  context: CrumblingAdapterContext<ActorId, OtherWorld>,
): TraversalWorldAdapter<CrumblingSupportId, CrumblingQueryWorld<ActorId, OtherWorld>> {
  const supports = new Map(context.definitions.map(({ supportId }, index) => [supportId, index]));
  if (!context.identity || supports.size !== context.definitions.length) {
    throw new Error("Crumbling adapter requires a world identity and distinct supports");
  }
  const actors = new Map<ActorId, number>();
  const isBranchActor = (actor: ActorId) =>
    actor === context.actorId || Object.is(actor, context.actorId);
  const actorKey = (actor: ActorId) => {
    if (!actors.has(actor)) {
      actors.set(actor, actors.size);
    }
    return actors.get(actor)!;
  };
  const supportKey = (support: CrumblingSupportId) => {
    const key = supports.get(support);
    if (key === undefined) {
      throw new Error("Unknown crumbling support identity");
    }
    return key;
  };
  const contactsKey = (contacts: CrumblingWorld<CrumblingSupportId, ActorId>["standingContacts"]) =>
    contacts.map(({ actorId, supportId }) => [supportKey(supportId), actorKey(actorId)]);
  return {
    beginStep(world, request) {
      const other = context.otherActors(world.otherWorld, request.timeSeconds);
      if (other.status === "unavailable") {
        return other;
      }
      const result = beginCrumblingStep(
        {
          definitions: context.definitions,
          occupancy: ({ branchActor, volume }) =>
            rectsOverlap(volume, branchActor.body) ||
            other.value.some(
              ({ actorId, body }) => !isBranchActor(actorId) && rectsOverlap(volume, body),
            )
              ? "occupied"
              : "clear",
        },
        {
          branchActor: { actorId: context.actorId, body: request.body },
          timeSeconds: request.timeSeconds,
        },
        world.crumbling,
      );
      return result.status === "unavailable"
        ? result
        : { status: "available", value: { ...world, crumbling: result.value } };
    },
    endStep(world, request) {
      const other = context.otherActors(world.otherWorld, request.timeSeconds);
      if (other.status === "unavailable") {
        return other;
      }
      const standingContacts = [
        ...request.standingSupportIds.map((supportId) => ({ actorId: context.actorId, supportId })),
        ...other.value.flatMap(({ actorId, standingSupportIds }) =>
          isBranchActor(actorId)
            ? []
            : standingSupportIds.map((supportId) => ({ actorId, supportId })),
        ),
      ].filter(({ supportId }) => supports.has(supportId));
      return {
        status: "available",
        value: {
          ...world,
          crumbling: endCrumblingStep(
            { standingContacts, timeSeconds: request.timeSeconds },
            world.crumbling,
          ),
        },
      };
    },
    key: ({ crumbling, otherWorld }) =>
      JSON.stringify([
        context.identity,
        context.otherKey(otherWorld),
        crumbling.supports.map(({ phase, supportId }) => [
          supportKey(supportId),
          phase.kind,
          phase.kind === "warning"
            ? phase.removeAtSeconds
            : phase.kind === "absent"
              ? phase.restoreAfterSeconds
              : null,
        ]),
        contactsKey(crumbling.standingContacts),
        contactsKey(crumbling.pendingContacts),
        crumbling.begunAtSeconds,
      ]),
    safe: (world, request) => context.safe(world.otherWorld, request),
    sampleColliders(world, time, seconds, bounds) {
      const geometry = context.sampleColliders(world.otherWorld, time, seconds, bounds);
      return {
        ...geometry,
        colliders: geometry.colliders.filter(({ supportId }) =>
          crumblingSupportPresent(world.crumbling, supportId),
        ),
      };
    },
  };
}
