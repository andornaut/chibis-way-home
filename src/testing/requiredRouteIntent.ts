import { EDGE, STEP_SECONDS } from "../core/index.ts";
import type { BirdTuning } from "../data/types/index.ts";
import { type BirdState, ordinaryHorizontalVelocity } from "../rules/bird.ts";
import type { Surface } from "../sim/zoneWalk.ts";

export const REQUIRED_ROUTE_CONTROLLER = "required-route-intent-v1";

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
    | "carried-momentum"
    | "dynamic-support"
    | "invalid-window"
    | "missed-support"
    | "missing-support"
    | "target-behind"
    | "unknown-ground-support";
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
