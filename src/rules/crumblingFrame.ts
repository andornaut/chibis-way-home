import { rectsOverlap } from "@andornaut/game-kit/rect";
import {
  beginCrumblingStep,
  type CrumblingDefinition,
  type CrumblingWorld,
  endCrumblingStep,
} from "@andornaut/game-kit/terrain/crumbling";

import type { CrumblingSupportId } from "../data/types";
import type { CrumblingActor } from "./crumbling";

export interface CrumblingFrameRequest<ActorId> {
  // Physical actors and transients; excludes scenery, introductions, pulses and support colliders.
  readonly actorIds: readonly ActorId[];
  // Complete actual bodies and solver-resolved standing identities, never overlap guesses.
  readonly actors: readonly CrumblingActor<ActorId>[];
  readonly timeSeconds: number;
}

function actualActors<ActorId>(request: CrumblingFrameRequest<ActorId>): void {
  const expected = new Set(request.actorIds);
  const seen = new Set<ActorId>();
  if (expected.size === 0 || expected.size !== request.actorIds.length) {
    throw new Error("Crumbling frame requires a nonempty distinct physical actor registry");
  }
  for (const { actorId, body } of request.actors) {
    if (!expected.has(actorId) || seen.has(actorId)) {
      throw new Error("Unexpected or repeated crumbling frame actor");
    }
    seen.add(actorId);
    if (
      ![body.x, body.y, body.width, body.height].every(Number.isFinite) ||
      body.width <= 0 ||
      body.height <= 0
    ) {
      throw new Error("Crumbling frame requires actual finite physical bodies");
    }
  }
  if (seen.size !== expected.size) {
    throw new Error("Crumbling frame is missing a physical actor");
  }
}

// Prepare once before any collider construction; commit separately from actor transactions.
export function beginCrumblingFrame<ActorId>(
  definitions: readonly CrumblingDefinition<CrumblingSupportId>[],
  request: CrumblingFrameRequest<ActorId>,
  world: CrumblingWorld<CrumblingSupportId, ActorId>,
): CrumblingWorld<CrumblingSupportId, ActorId> {
  actualActors(request);
  const result = beginCrumblingStep(
    {
      definitions,
      occupancy: ({ volume }) =>
        request.actors.some(({ body }) => rectsOverlap(volume, body)) ? "occupied" : "clear",
    },
    { branchActor: request.actors[0]!, timeSeconds: request.timeSeconds },
    world,
  );
  if (result.status === "unavailable") {
    throw new Error("Actual crumbling frame occupancy must be known");
  }
  return result.value;
}

// Called after every actor finishes physics; these contacts take effect next tick.
export function endCrumblingFrame<ActorId>(
  definitions: readonly CrumblingDefinition<CrumblingSupportId>[],
  request: CrumblingFrameRequest<ActorId>,
  world: CrumblingWorld<CrumblingSupportId, ActorId>,
): CrumblingWorld<CrumblingSupportId, ActorId> {
  actualActors(request);
  const supports = new Set(definitions.map(({ supportId }) => supportId));
  return endCrumblingStep(
    {
      standingContacts: request.actors.flatMap(({ actorId, standingSupportIds }) =>
        standingSupportIds
          .filter((supportId) => supports.has(supportId))
          .map((supportId) => ({ actorId, supportId })),
      ),
      timeSeconds: request.timeSeconds,
    },
    world,
  );
}
