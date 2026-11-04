import type { CrumblingWorld } from "@andornaut/game-kit/terrain/crumbling";

import type {
  AreaLayout,
  BirdTuning,
  CrumblingSupportId,
  ObjectLayout,
  Point,
  Rect,
} from "../data/types";
import type { BehaviourState } from "./behaviour";
import type { CrumblingPrediction } from "./behaviourReach";
import { birdBox, type BirdState, EDGE } from "./bird";
import { type CrumblingActor, crumblingSupportPresent } from "./crumbling";
import { effectiveHazardPhase } from "./effectiveCollision";
import { type Transient, transientBox } from "./transients";

// Chibi, behaviour-driven actors by layout identity and transients by their stable id.
export type CrumblingActorId = "chibi" | ObjectLayout | `transient:${number}`;
export type ZoneCrumblingWorld = CrumblingWorld<CrumblingSupportId, CrumblingActorId>;

// Moving physical actors; platforms are support colliders and timed hazards are stationary.
export function crumblingActorIndices(area: AreaLayout): readonly number[] {
  return area.objects.flatMap((object, index) =>
    object.behaviour &&
    object.collision === "hazard" &&
    effectiveHazardPhase(object, undefined) === undefined
      ? [index]
      : [],
  );
}

// The solver-selected support of a behaviour actor at its resolved position, if it stands.
export function behaviourStandingSupport(
  at: Point,
  state: BehaviourState | undefined,
): CrumblingSupportId | undefined {
  const physical = state?.traversal?.physical;
  if (
    physical?.grounded &&
    physical.supportId !== undefined &&
    physical.x === at.x &&
    physical.y === at.y
  ) {
    return physical.supportId;
  }
  const landing = state?.landing;
  return landing?.status === "supported" && landing.support
    ? (landing.support.owner ?? landing.support.rect)
    : undefined;
}

export function crumblingActors(
  tuning: BirdTuning,
  area: AreaLayout,
  actors: readonly number[],
  birdSupport: CrumblingSupportId | undefined,
  positions: readonly Point[],
  behaviours: readonly (BehaviourState | undefined)[],
  transients: readonly Transient[],
  bird: BirdState,
): {
  readonly actorIds: readonly CrumblingActorId[];
  readonly actors: readonly CrumblingActor<CrumblingActorId>[];
} {
  const physical: CrumblingActor<CrumblingActorId>[] = [
    {
      actorId: "chibi",
      body: birdBox(tuning, bird),
      standingSupportIds: birdSupport ? [birdSupport] : [],
    },
  ];
  for (const index of actors) {
    const object = area.objects[index]!;
    const at = positions[index] ?? object.origin;
    const support = behaviourStandingSupport(at, behaviours[index]);
    physical.push({
      actorId: object,
      // The whole layout rect bounds every pose and contact box.
      body: { ...at, height: object.height, width: object.width },
      standingSupportIds: support ? [support] : [],
    });
  }
  for (const entity of transients) {
    physical.push({
      actorId: `transient:${entity.id}`,
      body: transientBox(entity),
      standingSupportIds: [],
    });
  }
  return { actorIds: physical.map(({ actorId }) => actorId), actors: physical };
}

const FILTERED = new WeakMap<
  readonly Rect[],
  { readonly absent: readonly CrumblingSupportId[]; readonly rects: readonly Rect[] }
>();

export function absentSupports(
  world: ZoneCrumblingWorld | undefined,
): readonly CrumblingSupportId[] {
  return (
    world?.supports.flatMap(({ phase, supportId }) =>
      phase.kind === "absent" ? [supportId] : [],
    ) ?? []
  );
}

// Terrain without absent supports; the same array is reused while the absent set is unchanged.
export function presentTerrain(world: ZoneCrumblingWorld | undefined, solids: readonly Rect[]) {
  const absent = absentSupports(world);
  if (!absent.some((support) => solids.includes(support as Rect))) {
    return solids;
  }
  const cached = FILTERED.get(solids);
  if (
    cached &&
    cached.absent.length === absent.length &&
    cached.absent.every((support, index) => support === absent[index])
  ) {
    return cached.rects;
  }
  const rects = solids.filter((solid) => !absent.includes(solid));
  FILTERED.set(solids, { absent, rects });
  return rects;
}

export function supportPresent(
  world: ZoneCrumblingWorld | undefined,
  supportId: CrumblingSupportId,
): boolean {
  return !world || crumblingSupportPresent(world, supportId);
}

// Collider presence stays as now until each support's earliest possible change; later
// presence depends on future contacts and restoration occupancy, so it is unknown.
export function crumblingPrediction(
  area: AreaLayout,
  world: ZoneCrumblingWorld,
  tickEnd: number,
): CrumblingPrediction {
  const definitions = new Map(
    area.crumbling?.map((definition) => [definition.supportId, definition]),
  );
  const changes = world.supports.map(({ phase, supportId }) => {
    const definition = definitions.get(supportId)!;
    return {
      until:
        phase.kind === "intact"
          ? tickEnd + definition.profile.warningSeconds
          : phase.kind === "warning"
            ? phase.removeAtSeconds
            : phase.restoreAfterSeconds,
      volume: definition.volume,
    };
  });
  return {
    key: JSON.stringify(
      world.supports.map(({ phase }) =>
        phase.kind === "intact"
          ? 0
          : phase.kind === "warning"
            ? [1, phase.removeAtSeconds]
            : [2, phase.restoreAfterSeconds],
      ),
    ),
    unknown: (timeSeconds) =>
      timeSeconds < tickEnd - EDGE
        ? []
        : changes.flatMap(({ until, volume }) => (timeSeconds + EDGE >= until ? [volume] : [])),
  };
}
