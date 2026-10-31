import type { BirdTuning, Rect, ZoneLayout } from "../data/types";
import { STEP_SECONDS } from "../rules/step";
import { stepZone, type ZoneInput, type ZoneState } from "../rules/zone";

export interface NavigationConfig {
  readonly horizonTicks: number;
  readonly maxCandidates: number;
  readonly maxPhysicsSteps: number;
  readonly replanTicks: number;
}
export const NAVIGATION_DEFAULTS: NavigationConfig = {
  horizonTicks: 90,
  maxCandidates: 8,
  maxPhysicsSteps: 200000,
  replanTicks: 12,
};
export interface NavigationCounters {
  candidateRollouts: number;
  decisions: number;
  physicsSteps: number;
  budgetExhaustions: number;
}
export interface NavigationState {
  area: string;
  attempt: number;
  counters: NavigationCounters;
  continuation: { candidate: Candidate; elapsed: number } | undefined;
  lastX: number;
  lastY: number;
  queue: ZoneInput[];
  stalledTicks: number;
  status: "ready" | "no-safe-candidate" | "budget-exhausted";
  waypoint: { x: number; y: number } | undefined;
}
export interface Navigator {
  navigation?: NavigationState;
}
export function validateNavigation(config: Partial<NavigationConfig> = {}): NavigationConfig {
  const result = { ...NAVIGATION_DEFAULTS, ...config };
  for (const key of Object.keys(NAVIGATION_DEFAULTS) as (keyof NavigationConfig)[]) {
    if (
      !Number.isInteger(result[key]) ||
      result[key] < (key === "maxPhysicsSteps" ? 0 : 1) ||
      result[key] > NAVIGATION_DEFAULTS[key]
    ) {
      throw new Error(`Invalid navigation ${key}`);
    }
  }
  return result;
}
export function navigationCounters(bot: Navigator): NavigationCounters {
  return (
    bot.navigation?.counters ?? {
      budgetExhaustions: 0,
      candidateRollouts: 0,
      decisions: 0,
      physicsSteps: 0,
    }
  );
}
export function resetNavigation(bot: Navigator): void {
  if (bot.navigation) {
    bot.navigation.continuation = undefined;
    bot.navigation.queue = [];
    bot.navigation.waypoint = undefined;
  }
}
const IDLE: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };

// Local target is the next raised support face, not a precomputed route through a seed.
function waypoint(tuning: BirdTuning, layout: ZoneLayout, direction: -1 | 1, zone: ZoneState) {
  const area = layout.areas[zone.area]!;
  const supports: Rect[] = [...area.solids];
  area.objects.forEach((object, index) => {
    if (object.collision === "ledge" || object.collision === "solid") {
      supports.push({
        ...(zone.objects[index] ?? object.origin),
        height: object.height,
        width: object.width,
      });
    }
  });
  const foot = zone.bird.y + tuning.height;
  const front = zone.bird.x + (direction === 1 ? tuning.width : 0);
  const target = supports
    .filter((rect) => {
      const distance = direction === 1 ? rect.x - front : front - rect.x - rect.width;
      return (
        distance >= -tuning.width &&
        distance <= tuning.walkSpeed * STEP_SECONDS * NAVIGATION_DEFAULTS.horizonTicks &&
        rect.y < foot - 2
      );
    })
    .sort((a, b) => direction * (a.x - b.x))[0];
  return target
    ? { x: direction === 1 ? target.x : target.x + target.width, y: target.y }
    : undefined;
}
interface Candidate {
  readonly back: number;
  readonly delay: number;
  readonly hold: number;
  readonly stationary: number;
}
function action(direction: -1 | 1, candidate: Candidate, tick: number): ZoneInput {
  if (tick < candidate.back) {
    return { ...IDLE, move: direction === 1 ? -1 : 1 };
  }
  const active = tick - candidate.back - candidate.delay;
  if (active < 0) {
    return IDLE;
  }
  return {
    jumpHeld: active < candidate.hold,
    move: active < candidate.stationary ? 0 : direction,
    useHeld: false,
  };
}

export function plannedInput(
  tuning: BirdTuning,
  layout: ZoneLayout,
  config: Partial<NavigationConfig> | undefined,
  direction: -1 | 1,
  zone: ZoneState,
  bot: Navigator,
): ZoneInput {
  const limits = validateNavigation(config);
  const navigation = (bot.navigation ??= {
    area: zone.area,
    attempt: zone.attempt,
    continuation: undefined,
    counters: { budgetExhaustions: 0, candidateRollouts: 0, decisions: 0, physicsSteps: 0 },
    lastX: zone.bird.x,
    lastY: zone.bird.y,
    queue: [],
    stalledTicks: 0,
    status: "ready",
    waypoint: undefined,
  });
  if (navigation.area !== zone.area || navigation.attempt !== zone.attempt) {
    resetNavigation(bot);
    navigation.area = zone.area;
    navigation.attempt = zone.attempt;
    navigation.stalledTicks = 0;
  }
  if (Math.abs(zone.bird.x - navigation.lastX) + Math.abs(zone.bird.y - navigation.lastY) < 0.25) {
    navigation.stalledTicks++;
  } else {
    navigation.stalledTicks = 0;
  }
  navigation.lastX = zone.bird.x;
  navigation.lastY = zone.bird.y;
  if (navigation.counters.physicsSteps >= limits.maxPhysicsSteps) {
    if (navigation.status !== "budget-exhausted") {
      navigation.counters.budgetExhaustions++;
    }
    navigation.status = "budget-exhausted";
    navigation.queue = [];
    return IDLE;
  }
  if (navigation.queue.length) {
    if (navigation.continuation) {
      navigation.continuation.elapsed++;
    }
    return navigation.queue.shift()!;
  }
  navigation.counters.decisions++;
  navigation.waypoint = waypoint(tuning, layout, direction, zone);
  const full = Math.ceil(tuning.jumpRiseTime / STEP_SECONDS) + 1;
  const candidates: Candidate[] = [
    { back: 0, delay: 0, hold: 0, stationary: 0 },
    { back: 0, delay: 0, hold: 1, stationary: 0 },
    { back: 0, delay: 0, hold: full, stationary: 0 },
    { back: 0, delay: 0, hold: 0, stationary: Number.MAX_SAFE_INTEGER },
    { back: 0, delay: 24, hold: 1, stationary: 0 },
    { back: 0, delay: 24, hold: full, stationary: 0 },
    { back: 18, delay: 0, hold: full, stationary: 0 },
    { back: 0, delay: 0, hold: full, stationary: 12 },
  ];
  let best: { candidate: Candidate; elapsed: number; score: number; ticks: number } | undefined;
  const choices = candidates.map((candidate) => ({ candidate, elapsed: 0 }));
  if (navigation.continuation) {
    choices.unshift(navigation.continuation);
  }
  for (const { candidate, elapsed } of choices.slice(0, limits.maxCandidates)) {
    if (navigation.counters.physicsSteps + limits.horizonTicks > limits.maxPhysicsSteps) {
      break;
    }
    navigation.counters.candidateRollouts++;
    let predicted = zone;
    let safe = true;
    let airborne = !zone.bird.grounded;
    let predictedTicks = 0;
    for (let tick = 0; tick < limits.horizonTicks; tick++) {
      predicted = stepZone(
        tuning,
        layout,
        STEP_SECONDS,
        action(direction, candidate, tick + elapsed),
        predicted,
      );
      navigation.counters.physicsSteps++;
      predictedTicks++;
      if (predicted.death || predicted.turnedBack) {
        safe = false;
        break;
      }
      if (predicted.cleared || predicted.area !== zone.area) {
        break;
      }
      if (airborne && predicted.bird.grounded) {
        break;
      }
      airborne ||= !predicted.bird.grounded;
    }
    const forwardArea =
      layout.areas[zone.area]!.walkLinks?.[direction === 1 ? "right" : "left"]?.area;
    if (predicted.area !== zone.area && predicted.area !== forwardArea) {
      continue;
    }
    if (!safe || (!predicted.bird.grounded && !predicted.cleared && predicted.area === zone.area)) {
      continue;
    }
    let score = direction * (predicted.bird.x - zone.bird.x);
    if (navigation.waypoint) {
      const needed = Math.max(0, zone.bird.y + tuning.height - navigation.waypoint.y);
      score += 2 * Math.min(needed, zone.bird.y - predicted.bird.y);
    }
    if (predicted.cleared || predicted.area !== zone.area) {
      score += 10000;
    }
    score -= candidate.hold > 0 ? 1 : 0;
    if (candidate.back > 0 && navigation.stalledTicks >= 48) {
      score += 100;
    }
    if (!best || score > best.score) {
      best = { candidate, elapsed, score, ticks: predictedTicks };
    }
  }
  if (!best) {
    navigation.status =
      navigation.counters.physicsSteps + limits.horizonTicks > limits.maxPhysicsSteps
        ? "budget-exhausted"
        : "no-safe-candidate";
    if (navigation.status === "budget-exhausted") {
      navigation.counters.budgetExhaustions++;
    }
    return IDLE;
  }
  navigation.status = "ready";
  navigation.continuation = { candidate: best.candidate, elapsed: best.elapsed + 1 };
  navigation.queue = Array.from({ length: Math.min(limits.replanTicks, best.ticks) }, (_, tick) =>
    action(direction, best.candidate, tick + best.elapsed),
  );
  return navigation.queue.shift()!;
}
