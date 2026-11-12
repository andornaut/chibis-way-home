import type { CrumblingWorld } from "@andornaut/game-kit/terrain/crumbling";

import { EDGE, rectAt } from "../core/index.ts";
import type {
  AreaLayout,
  BirdTuning,
  CrumblingSupportId,
  ObjectLayout,
  Point,
  Rect,
} from "../data/types/index.ts";
import type { BehaviourState } from "./behaviour.ts";
import type { CrumblingPrediction } from "./behaviourReach.ts";
import { birdBox, type BirdState } from "./bird.ts";
import { type CrumblingActor, crumblingSupportPresent } from "./crumbling.ts";
import { effectiveHazardPhase } from "./effectiveCollision.ts";
import { type Transient, transientBox } from "./transients.ts";

// Chibi, behaviour-driven actors by layout identity and transients by their stable id.
type CrumblingActorId = "chibi" | ObjectLayout | `transient:${number}`;
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

export function crumblingActors(
  tuning: BirdTuning,
  area: AreaLayout,
  actors: readonly number[],
  birdSupport: CrumblingSupportId | undefined,
  positions: readonly Point[],
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
  // Only Chibi's landing starts a warning; other actors are bodies that keep a support from
  // restoring.
  for (const index of actors) {
    const object = area.objects[index]!;
    physical.push({
      actorId: object,
      // The whole layout rect bounds every pose and contact box.
      body: rectAt(object, positions[index] ?? object.origin),
      standingSupportIds: [],
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

function absentSupports(world: ZoneCrumblingWorld | undefined): readonly CrumblingSupportId[] {
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

// Clocked support presence stays as now until each support's current state ends; later presence
// is unknown, as crumbling presence is, though the clock is deterministic.
export function clockedSupportPrediction(
  area: AreaLayout,
  supports: readonly number[],
  behaviours: readonly (BehaviourState | undefined)[],
  timeSeconds: number,
): CrumblingPrediction {
  const changes = supports.map((index) => {
    const object = area.objects[index]!;
    const plan = object.behaviour!;
    const state = behaviours[index];
    const key = state?.stateKey ?? plan.initial;
    const condition = plan.states[key]!.transitions[0]!.when[0]!;
    const seconds = condition.kind === "elapsed" ? condition.seconds : 0;
    return {
      key,
      until: timeSeconds + Math.max(0, seconds - (state?.elapsed ?? 0)),
      volume: rectAt(object, object.origin),
    };
  });
  return {
    key: JSON.stringify(changes.map(({ key, until }) => [key, Math.round(until * 1e6)])),
    unknown: (time) =>
      changes.flatMap(({ until, volume }) => (time + EDGE >= until ? [volume] : [])),
  };
}

// One prediction from crumbling and clocked supports' predictions.
export function joinedPrediction(
  first: CrumblingPrediction | undefined,
  second: CrumblingPrediction | undefined,
): CrumblingPrediction | undefined {
  if (!first || !second) {
    return first ?? second;
  }
  return {
    key: `${first.key}|${second.key}`,
    unknown: (time) => [...first.unknown(time), ...second.unknown(time)],
  };
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
