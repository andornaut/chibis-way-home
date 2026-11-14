import { rectsOverlap } from "@andornaut/game-kit/rect";

import { EDGE, STEP_SECONDS } from "../core/index.ts";
import type {
  BirdTuning,
  HazardPhase,
  ObjectLayout,
  Rect,
  ZoneLayout,
} from "../data/types/index.ts";
import { type BehaviourState, contactBox } from "../rules/behaviour.ts";
import { type BirdState, ordinaryHorizontalVelocity } from "../rules/bird.ts";
import { effectiveHazardPhase, validateHazardPhases } from "../rules/effectiveCollision.ts";
import { timedHazardRect } from "../rules/timedHazard.ts";
import type { ZoneState } from "../rules/zone.ts";
import type { Surface } from "../sim/zoneWalk.ts";

export const REQUIRED_ROUTE_CONTROLLER = "required-route-intent-v2";

export type RouteHazardProvenance = "non-hazard" | "static" | "timed" | "unsupported";

// A declared clock remains timed even when its current state cannot pass native validation.
export function routeHazardProvenance(
  state: BehaviourState | undefined,
  object: ObjectLayout,
): RouteHazardProvenance {
  if (
    Object.values(object.behaviour?.states ?? {}).some((node) => node.hazardPhase !== undefined)
  ) {
    return "timed";
  }
  if (object.collision !== "hazard") {
    return "non-hazard";
  }
  return object.behaviour === undefined &&
    state === undefined &&
    object.motion.algorithm === "static" &&
    object.motion.playback === undefined &&
    object.motion.variance === 0 &&
    object.reaction.kind === "none" &&
    object.orbit === undefined &&
    object.contact === undefined &&
    object.scene === undefined &&
    object.crumbling === undefined &&
    object.forcedTransit === undefined
    ? "static"
    : "unsupported";
}

export interface ResolvedRouteTarget {
  readonly index: number;
  readonly interval: { readonly min: number; readonly max: number } | undefined;
  readonly surface: Surface | undefined;
}

export interface RequiredRouteIntentTarget {
  readonly index: number;
  readonly surface: Surface;
  readonly window: { readonly min: number; readonly max: number };
}

export interface RouteIntentUnavailable {
  readonly index: number;
  readonly reason:
    | "area-mismatch"
    | "ambiguous-assist"
    | "carried-momentum"
    | "dynamic-support"
    | "hazard-margin-unavailable"
    | "invalid-window"
    | "missed-support"
    | "missing-support"
    | "target-behind"
    | "unknown-ground-support";
}

export function staticRouteAssist(
  tuning: BirdTuning,
  current: RouteIntentCurrent,
  surfaces: readonly Surface[],
  required: RequiredRouteIntentTarget,
):
  | { readonly assist: RequiredRouteIntentTarget | undefined }
  | { readonly unavailable: RouteIntentUnavailable } {
  if (!current.bird.grounded || current.support === undefined) {
    return { assist: undefined };
  }
  const support = current.support;
  const banks = surfaces.filter(
    (surface) =>
      surface.area === current.area &&
      surface.left >= support.right - EDGE &&
      surface.right <= required.surface.left + EDGE &&
      surface.y > Math.max(support.y, required.surface.y),
  );
  if (banks.length > 1) {
    return { unavailable: { index: required.index, reason: "ambiguous-assist" } };
  }
  const bank = banks[0];
  if (bank === undefined) {
    return { assist: undefined };
  }
  const prepared = prepareRequiredRouteIntent(tuning, [
    { index: required.index, interval: undefined, surface: bank },
  ]);
  return "unavailable" in prepared ? prepared : { assist: prepared.targets[0] };
}

export interface CurrentHazardNode {
  readonly index: number;
  readonly phase: HazardPhase;
  readonly rect: Rect;
  readonly remaining: number;
  readonly stateKey: string;
}

// Only the current deterministic wait node contributes time. No future state is sampled.
export function currentHazardNode(
  layout: ZoneLayout,
  zone: ZoneState,
  index: number,
): CurrentHazardNode | undefined {
  const object = layout.areas[zone.area]?.objects[index];
  const state = zone.behaviours[index];
  if (!object || !state?.active || !Number.isFinite(state.elapsed) || state.elapsed < 0) {
    return undefined;
  }
  try {
    validateHazardPhases(object);
  } catch {
    return undefined;
  }
  const node = object.behaviour?.states[state.stateKey];
  if (node === undefined) {
    return undefined;
  }
  const transition = node?.transitions[0];
  const condition = transition?.when[0];
  const phase = effectiveHazardPhase(object, state);
  if (
    phase === undefined ||
    node?.motion.kind !== "wait" ||
    node.transitions.length !== 1 ||
    transition?.score !== undefined ||
    transition?.when.length !== 1 ||
    condition?.kind !== "elapsed" ||
    !Number.isFinite(condition.seconds) ||
    condition.seconds <= 0
  ) {
    return undefined;
  }
  return {
    index,
    phase,
    rect: timedHazardRect(object, zone.objects[index] ?? object.origin),
    remaining: Math.max(0, condition.seconds - state.elapsed),
    stateKey: state.stateKey,
  };
}

export interface FlatCrossing {
  readonly clearX: number;
  readonly floor: Rect;
  readonly hazards: readonly CurrentHazardNode[];
  readonly requiredIndex: number;
  readonly upperTicks: number;
}

export interface HazardIntentContext {
  readonly crossing: FlatCrossing | undefined;
  readonly crossingSteps: number;
  readonly holding: number;
  readonly refuge: RequiredRouteIntentTarget | undefined;
}

export type RouteHazardDecision =
  | { readonly kind: "none" }
  | { readonly kind: "hold" }
  | { readonly crossing: FlatCrossing; readonly kind: "cross" }
  | { readonly unavailable: RouteIntentUnavailable };

// Discard all ramp distance. Once native actuation reaches walk speed, bound the remaining travel.
export function flatCrossingTicks(tuning: BirdTuning, distance: number): number | undefined {
  const gain = ordinaryHorizontalVelocity(tuning, STEP_SECONDS, 1, true, 0);
  if (
    ![gain, distance, tuning.walkSpeed].every(Number.isFinite) ||
    gain <= 0 ||
    distance < 0 ||
    tuning.walkSpeed <= 0
  ) {
    return undefined;
  }
  return (
    Math.ceil(tuning.walkSpeed / gain) + Math.ceil(distance / (tuning.walkSpeed * STEP_SECONDS)) + 1
  );
}

export function routeHazardIntent(
  tuning: BirdTuning,
  layout: ZoneLayout,
  zone: ZoneState,
  context: HazardIntentContext,
  required: RequiredRouteIntentTarget,
): RouteHazardDecision {
  const fail = (): RouteHazardDecision => ({
    unavailable: { index: required.index, reason: "hazard-margin-unavailable" },
  });
  const { bird } = zone;
  const area = layout.areas[zone.area];
  if (!area) {
    return fail();
  }
  const body = { height: tuning.height, width: tuning.width, x: bird.x, y: bird.y };
  const provenance = area.objects.map((object, index) =>
    routeHazardProvenance(zone.behaviours[index], object),
  );
  if (provenance.some((kind) => kind === "unsupported")) {
    return fail();
  }
  const timed = provenance.flatMap((kind, index) =>
    kind === "timed" ? [currentHazardNode(layout, zone, index)] : [],
  );
  if (timed.some((hazard) => hazard === undefined)) {
    return fail();
  }
  const relevant = (timed as CurrentHazardNode[]).flatMap(({ index, rect }) => {
    return rect.x + rect.width + EDGE >= bird.x &&
      rect.x < required.window.min &&
      rect.y < body.y + body.height &&
      rect.y + rect.height > body.y
      ? [{ index, rect }]
      : [];
  });
  const prior = context.crossing;
  if (prior === undefined && relevant.length === 0) {
    return { kind: "none" };
  }
  if (
    zone.death !== undefined ||
    zone.cleared ||
    zone.turnedBack ||
    zone.door !== undefined ||
    required.surface.area !== zone.area ||
    !bird.grounded ||
    bird.vy !== 0 ||
    bird.vx < 0 ||
    bird.vx > tuning.walkSpeed ||
    !Number.isFinite(bird.vx) ||
    bird.carryVx !== 0 ||
    (bird.dash?.remainingSeconds ?? 0) !== 0 ||
    context.holding !== 0 ||
    bird.jumpHeld ||
    bird.bufferLeft !== 0 ||
    zone.forcedTransit !== undefined ||
    zone.pulses.length !== 0 ||
    zone.transients.length !== 0 ||
    (area.crumbling?.length ?? 0) !== 0 ||
    Math.abs(required.surface.y - bird.y - tuning.height) > EDGE
  ) {
    return fail();
  }
  const hazards = (prior?.hazards ?? relevant).map(({ index }) =>
    currentHazardNode(layout, zone, index),
  );
  if (hazards.some((hazard) => hazard === undefined)) {
    return fail();
  }
  const observed = hazards as CurrentHazardNode[];
  if (observed.length !== 1) {
    return fail();
  }
  const farEdge = Math.max(...observed.map(({ rect }) => rect.x + rect.width));
  const distance = Math.max(0, farEdge - (bird.x + tuning.width)) + tuning.width + EDGE;
  const clearX = prior?.clearX ?? bird.x + distance;
  const corridor = {
    ...body,
    width: clearX + tuning.walkSpeed * STEP_SECONDS - bird.x + tuning.width,
  };
  const floor =
    prior?.floor ??
    area.solids.find(
      (solid) =>
        Math.abs(solid.y - bird.y - tuning.height) <= EDGE &&
        solid.x <= bird.x + EDGE &&
        solid.x + solid.width >= corridor.x + corridor.width,
    );
  if (
    !floor ||
    !area.solids.includes(floor) ||
    Math.abs(floor.y - bird.y - tuning.height) > EDGE ||
    floor.x > bird.x + EDGE ||
    floor.x + floor.width < corridor.x + corridor.width ||
    clearX + tuning.walkSpeed * STEP_SECONDS > required.window.max + EDGE ||
    area.solids.some((solid) => rectsOverlap(corridor, solid))
  ) {
    return fail();
  }
  for (const [index, object] of area.objects.entries()) {
    if (
      object.orbit ||
      object.crumbling ||
      object.forcedTransit ||
      object.contact ||
      object.scene !== undefined ||
      object.reaction.kind !== "none" ||
      object.motion.algorithm !== "static" ||
      object.motion.variance !== 0
    ) {
      return fail();
    }
    if (object.behaviour && currentHazardNode(layout, zone, index) === undefined) {
      return fail();
    }
    const at = zone.objects[index] ?? object.origin;
    const rect =
      provenance[index] === "static"
        ? contactBox(object, at, zone.behaviours[index]?.facing ?? 1, zone.behaviours[index]?.axis)
        : timedHazardRect(object, at);
    if (
      object.collision !== "none" &&
      rectsOverlap(corridor, rect) &&
      !observed.some((hazard) => hazard.index === index)
    ) {
      return fail();
    }
  }
  if (prior !== undefined) {
    if (bird.x > prior.clearX) {
      return { kind: "none" };
    }
    if (
      prior.requiredIndex !== required.index ||
      context.crossingSteps >= prior.upperTicks ||
      observed.some(
        (hazard, index) =>
          hazard.phase !== "inactive" || hazard.stateKey !== prior.hazards[index]?.stateKey,
      )
    ) {
      return fail();
    }
    return { crossing: prior, kind: "cross" };
  }
  if (observed.some((hazard) => hazard.phase !== "inactive")) {
    const refuge = context.refuge;
    const stopX = bird.x + brakingDistance(tuning, bird.vx);
    const stoppedBody = { ...body, width: stopX - bird.x + tuning.width };
    if (
      !refuge ||
      stopX < refuge.window.min - EDGE ||
      stopX > refuge.window.max + EDGE ||
      observed.some((hazard) => rectsOverlap(stoppedBody, hazard.rect))
    ) {
      return fail();
    }
    return { kind: "hold" };
  }
  const upperTicks = flatCrossingTicks(tuning, distance);
  if (
    upperTicks === undefined ||
    observed.some((hazard) => hazard.remaining <= (upperTicks + 1) * STEP_SECONDS)
  ) {
    return fail();
  }
  return {
    crossing: { clearX, floor, hazards: observed, requiredIndex: required.index, upperTicks },
    kind: "cross",
  };
}

export type PreparedRouteIntent =
  | { readonly targets: readonly RequiredRouteIntentTarget[] }
  | { readonly unavailable: RouteIntentUnavailable };

// These are controller aiming windows, not replacements for the original witness predicate.
export function prepareRequiredRouteIntent(
  tuning: BirdTuning,
  targets: readonly ResolvedRouteTarget[],
): PreparedRouteIntent {
  const ordered: RequiredRouteIntentTarget[] = [];
  for (const { index, interval, surface } of targets) {
    if (surface === undefined) {
      return { unavailable: { index, reason: "missing-support" } };
    }
    if (surface.mover !== undefined) {
      return { unavailable: { index, reason: "dynamic-support" } };
    }
    const window = interval ?? { max: surface.right - tuning.width, min: surface.left };
    if (
      !Number.isFinite(window.min) ||
      !Number.isFinite(window.max) ||
      window.min > window.max ||
      window.min < surface.left - EDGE ||
      window.max + tuning.width > surface.right + EDGE
    ) {
      return { unavailable: { index, reason: "invalid-window" } };
    }
    ordered.push({ index, surface, window });
  }
  ordered.sort((a, b) => a.window.min - b.window.min || a.index - b.index);
  return { targets: ordered };
}

export interface RouteIntentCurrent {
  readonly area: string;
  readonly bird: Pick<BirdState, "carryVx" | "grounded" | "vx" | "vy" | "x" | "y">;
  readonly support: Surface | undefined;
}

export type RequiredRouteIntentDecision =
  | { readonly inhibitNewJump: boolean; readonly move: -1 | 0 | 1 }
  | { readonly unavailable: RouteIntentUnavailable };

// Sum the positive native braking velocities as an arithmetic series.
function brakingDistance(tuning: BirdTuning, velocity: number): number {
  const decrement = tuning.brakeAccel * STEP_SECONDS;
  const steps = Math.max(0, Math.ceil(Math.abs(velocity) / decrement) - 1);
  return (
    Math.sign(velocity) *
    STEP_SECONDS *
    (steps * Math.abs(velocity) - (decrement * steps * (steps + 1)) / 2)
  );
}

// Current velocity supplies an analytic braking distance, with no simulated future steps.
// A discrete input may miss even an exact window; it never snaps position or widens a target.
export function requiredRouteIntent(
  tuning: BirdTuning,
  current: RouteIntentCurrent,
  target: RequiredRouteIntentTarget,
): RequiredRouteIntentDecision {
  const { bird, support } = current;
  const { index, surface, window } = target;
  if (current.area !== surface.area) {
    return { unavailable: { index, reason: "area-mismatch" } };
  }
  if (surface.mover !== undefined || support?.mover !== undefined) {
    return { unavailable: { index, reason: "dynamic-support" } };
  }
  if (bird.carryVx !== 0) {
    return { unavailable: { index, reason: "carried-momentum" } };
  }
  if (bird.grounded && support === undefined) {
    return { unavailable: { index, reason: "unknown-ground-support" } };
  }
  if (bird.x > window.max + EDGE) {
    return { unavailable: { index, reason: "target-behind" } };
  }
  if (
    !bird.grounded &&
    bird.vy > 0 &&
    bird.x >= window.min - EDGE &&
    bird.y + tuning.height > surface.y + EDGE
  ) {
    return { unavailable: { index, reason: "missed-support" } };
  }
  const onTarget = support?.key === surface.key;
  const supportedDescent =
    support !== undefined && surface.y > support.y && surface.left <= support.right + EDGE;
  const inhibitNewJump = bird.grounded && (onTarget || supportedDescent);
  const above = bird.y + tuning.height <= surface.y + EDGE;
  if (!onTarget && !above) {
    return { inhibitNewJump, move: 1 };
  }
  const inWindow = bird.x >= window.min - EDGE && bird.x <= window.max + EDGE;
  const direction = bird.x < window.min ? 1 : -1;
  // Guard the immediate native acceleration input, without advancing a world or sampling a route.
  const velocity = ordinaryHorizontalVelocity(
    tuning,
    STEP_SECONDS,
    direction,
    bird.grounded,
    bird.vx,
  );
  const stoppingX = bird.x + velocity * STEP_SECONDS + brakingDistance(tuning, velocity);
  const crossesWindow =
    direction > 0 ? stoppingX > window.max + EDGE : stoppingX < window.min - EDGE;
  return { inhibitNewJump, move: inWindow || crossesWindow ? 0 : direction };
}
