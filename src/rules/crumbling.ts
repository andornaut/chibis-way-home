import { rectsOverlap } from "@andornaut/game-kit/rect";
import type {
  CrumblingDefinition,
  CrumblingProfile,
  CrumblingWorld,
} from "@andornaut/game-kit/terrain/crumbling";

import { rectAt } from "../core/index.ts";
import type { AreaLayout, CrumblingSupportId, Rect } from "../data/types/index.ts";

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
        volume: rectAt(object, object.origin),
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
  // Neighbour-derived terrain tiles have one painted owner; hidden underlays are not retained.
  for (const [index, terrain] of area.terrain.entries()) {
    if (
      terrain.crumbling &&
      area.solids.some(
        (other, otherIndex) => otherIndex !== index && rectsOverlap(area.solids[index]!, other),
      )
    ) {
      throw new Error("Crumbling terrain must not overlap another terrain collider");
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
