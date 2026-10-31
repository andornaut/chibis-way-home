import { SCREEN, TILE } from "../data/screen";
import type { BirdTuning, Rect, ZoneLayout } from "../data/types";
import { STEP_SECONDS } from "../rules/step";
import { stepZone, type ZoneInput, type ZoneState } from "../rules/zone";
export interface NavigationConfig {
  readonly profile: "quick" | "validation";
  readonly horizonTicks: number;
  readonly maxCandidates: number;
  readonly maxPhysicsSteps: number;
  readonly replanTicks: number;
}
export const NAVIGATION_DEFAULTS: NavigationConfig = {
  horizonTicks: 90,
  maxCandidates: 8,
  maxPhysicsSteps: 200000,
  profile: "quick",
  replanTicks: 12,
};
export const NAVIGATION_VALIDATION: NavigationConfig = {
  ...NAVIGATION_DEFAULTS,
  maxPhysicsSteps: 2000000,
  profile: "validation",
};
export interface NavigationCounters {
  candidateRollouts: number;
  decisions: number;
  physicsSteps: number;
  budgetExhaustions: number;
}
interface FailedChoice {
  readonly area: string;
  readonly choice: string | null;
  readonly phase: string | null;
  readonly x: number;
  readonly y: number;
}
export interface NavigationMemory {
  readonly deaths: readonly FailedChoice[];
}
export interface NavigationState {
  area: string;
  attempt: number;
  cache:
    | {
        config: string;
        index: number;
        layout: ZoneLayout;
        states: readonly ZoneState[];
        tuning: BirdTuning;
      }
    | undefined;
  counters: NavigationCounters;
  decision: FailedChoice | undefined;
  intent: "advance" | "board" | "jump" | "recover" | "ride" | "transfer" | "wait";
  continuation:
    | {
        candidate: Candidate;
        elapsed: number;
      }
    | undefined;
  lastX: number;
  lastY: number;
  queue: ZoneInput[];
  stalledTicks: number;
  status: "ready" | "no-safe-candidate" | "budget-exhausted";
  waypoint:
    | {
        width?: number;
        x: number;
        y: number;
      }
    | undefined;
}
export interface Navigator {
  navigation?: NavigationState;
  navigationMemory?: NavigationMemory;
}
export function validateNavigation(config: Partial<NavigationConfig> = {}): NavigationConfig {
  if (
    config.profile !== undefined &&
    config.profile !== "quick" &&
    config.profile !== "validation"
  ) {
    throw new Error("Invalid navigation profile");
  }
  const defaults = config.profile === "validation" ? NAVIGATION_VALIDATION : NAVIGATION_DEFAULTS;
  const result = { ...defaults, ...config };
  for (const key of ["horizonTicks", "maxCandidates", "maxPhysicsSteps", "replanTicks"] as const) {
    if (
      !Number.isInteger(result[key]) ||
      result[key] < (key === "maxPhysicsSteps" ? 0 : 1) ||
      result[key] > defaults[key]
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
export function rememberNavigationFailure(deadZone: ZoneState, bot: Navigator): NavigationMemory {
  const previous = bot.navigationMemory ?? { deaths: [] };
  if (!deadZone.death) {
    return previous;
  }
  const decision = bot.navigation?.decision;
  const failure: FailedChoice =
    decision?.area === deadZone.area
      ? decision
      : {
          area: deadZone.area,
          choice: null,
          phase: null,
          x: deadZone.bird.x,
          y: deadZone.bird.y,
        };
  const memory = { deaths: [...previous.deaths, failure].slice(-16) };
  bot.navigationMemory = memory;
  return memory;
}
export function restoreNavigationMemory(memory: NavigationMemory, bot: Navigator): void {
  bot.navigationMemory = { deaths: memory.deaths.slice(-16).map((failure) => ({ ...failure })) };
}
function phase(layout: ZoneLayout, zone: ZoneState): string {
  return JSON.stringify(
    layout.areas[zone.area]!.objects.flatMap((object, index) => {
      if (
        object.collision === "none" ||
        Math.abs((zone.objects[index] ?? object.origin).x - zone.bird.x) > SCREEN.width ||
        (!object.behaviour &&
          object.motion.algorithm === "static" &&
          object.reaction.kind === "none")
      ) {
        return [];
      }
      const at = zone.objects[index] ?? object.origin,
        behaviour = zone.behaviours[index];
      return [
        [
          index,
          Math.round(at.x / TILE),
          Math.round(at.y / TILE),
          behaviour?.stateKey,
          behaviour ? Math.floor(behaviour.elapsed * 10) : undefined,
        ],
      ];
    }),
  );
}
function onMover(tuning: BirdTuning, layout: ZoneLayout, zone: ZoneState): boolean {
  return (
    zone.bird.grounded &&
    layout.areas[zone.area]!.objects.some((object, index) => {
      if (
        (object.collision !== "solid" && object.collision !== "ledge") ||
        (!object.behaviour && object.motion.algorithm === "static")
      ) {
        return false;
      }
      const at = zone.objects[index] ?? object.origin;
      return (
        Math.abs(at.y - zone.bird.y - tuning.height) < 1 &&
        zone.bird.x + tuning.width > at.x &&
        zone.bird.x < at.x + object.width
      );
    })
  );
}
export function resetNavigation(bot: Navigator): void {
  if (bot.navigation) {
    bot.navigation.cache = undefined;
    bot.navigation.continuation = undefined;
    bot.navigation.queue = [];
    bot.navigation.waypoint = undefined;
  }
}
const IDLE: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };
// The nearest blocking face selects a local support goal; every action still needs real-rule validation.
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
  const foot = zone.bird.y + tuning.height,
    front = zone.bird.x + (direction === 1 ? tuning.width : 0);
  const distance = (rect: Rect) => (direction === 1 ? rect.x - front : front - rect.x - rect.width);
  const nearby = supports
    .filter((rect) => distance(rect) >= -SCREEN.width / 2 && distance(rect) <= SCREEN.width / 2)
    .sort((a, b) => Math.abs(distance(a)) - Math.abs(distance(b)))
    .slice(0, 64);
  // Roofs entirely above the body do not block the route underneath them.
  const obstacle = nearby
    .filter(
      (rect) =>
        distance(rect) >= -tuning.width && rect.y < foot - 2 && rect.y + rect.height > zone.bird.y,
    )
    .sort((a, b) => distance(a) - distance(b))[0];
  if (!obstacle) {
    const danger = area.objects.some(
      (object, index) =>
        object.collision === "hazard" &&
        (zone.objects[index] ?? object.origin).y < foot &&
        Math.abs((zone.objects[index] ?? object.origin).x - front) <= SCREEN.width / 2,
    );
    const refuge = danger
      ? nearby
          .filter(
            (rect) =>
              rect.y < foot - 2 &&
              foot - rect.y <= (tuning.jumpSpeed * tuning.jumpRiseTime) / 2 &&
              distance(rect) >= -tuning.width &&
              rect.width >= tuning.width * 2,
          )
          .sort((a, b) => distance(a) - distance(b))[0]
      : undefined;
    return refuge ? { width: refuge.width, x: refuge.x, y: refuge.y } : undefined;
  }
  const rise = foot - obstacle.y,
    fullHeight = (tuning.jumpSpeed * tuning.jumpRiseTime) / 2;
  const intermediate =
    rise > fullHeight
      ? nearby
          .filter(
            (rect) =>
              rect !== obstacle &&
              rect.y < foot - 2 &&
              foot - rect.y <= fullHeight &&
              distance(rect) <= distance(obstacle),
          )
          .sort((a, b) => b.y - a.y + 0.25 * (distance(b) - distance(a)))[0]
      : undefined;
  const target = intermediate ?? obstacle;
  return {
    width: target.width,
    x: direction === 1 ? target.x : target.x + target.width,
    y: target.y,
  };
}
interface Candidate {
  readonly brakeAfter?: number;
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
    move:
      active < candidate.stationary || active >= (candidate.brakeAfter ?? Number.MAX_SAFE_INTEGER)
        ? 0
        : direction,
    useHeld: false,
  };
}
function samePrediction(expected: ZoneState, actual: ZoneState, full: boolean): boolean {
  if (
    expected.area !== actual.area ||
    expected.attempt !== actual.attempt ||
    expected.cleared !== actual.cleared ||
    expected.turnedBack !== actual.turnedBack ||
    expected.death !== actual.death ||
    JSON.stringify(expected.bird) !== JSON.stringify(actual.bird)
  ) {
    return false;
  }
  if (!full) {
    return true;
  }
  return (
    expected.seconds === actual.seconds &&
    expected.seed === actual.seed &&
    expected.door === actual.door &&
    expected.useHeld === actual.useHeld &&
    JSON.stringify([
      expected.behaviours,
      expected.objects,
      expected.transients,
      expected.pulses,
    ]) === JSON.stringify([actual.behaviours, actual.objects, actual.transients, actual.pulses])
  );
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
    cache: undefined,
    continuation: undefined,
    counters: { budgetExhaustions: 0, candidateRollouts: 0, decisions: 0, physicsSteps: 0 },
    decision: undefined,
    intent: "advance",
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
  const cacheConfig = JSON.stringify([direction, limits]);
  if (navigation.queue.length && navigation.cache) {
    const cache = navigation.cache;
    const expected = cache.states[cache.index];
    if (
      cache.config === cacheConfig &&
      cache.layout === layout &&
      cache.tuning === tuning &&
      expected &&
      samePrediction(expected, zone, cache.index % limits.replanTicks === 0)
    ) {
      cache.index++;
      if (navigation.continuation) {
        navigation.continuation.elapsed++;
      }
      return navigation.queue.shift()!;
    }
    resetNavigation(bot);
  }
  if (navigation.counters.physicsSteps >= limits.maxPhysicsSteps) {
    if (navigation.status !== "budget-exhausted") {
      navigation.counters.budgetExhaustions++;
    }
    navigation.status = "budget-exhausted";
    navigation.queue = [];
    return IDLE;
  }
  navigation.counters.decisions++;
  navigation.waypoint = waypoint(tuning, layout, direction, zone);
  const currentPhase = phase(layout, zone);
  const full = Math.ceil(tuning.jumpRiseTime / STEP_SECONDS) + 1;
  const candidates: Candidate[] = [
    { back: 0, delay: 0, hold: 0, stationary: 0 },
    { back: 0, delay: 0, hold: 1, stationary: 0 },
    { back: 0, delay: 0, hold: full, stationary: 0 },
    { back: 0, delay: 0, hold: 0, stationary: Number.MAX_SAFE_INTEGER },
    {
      back: 0,
      brakeAfter:
        navigation.waypoint?.width === undefined
          ? Number.MAX_SAFE_INTEGER
          : Math.max(
              1,
              Math.round(
                Math.abs(
                  navigation.waypoint.x +
                    (navigation.waypoint.width - tuning.width) / 2 -
                    zone.bird.x,
                ) /
                  tuning.walkSpeed /
                  STEP_SECONDS,
              ),
            ),
      delay: 0,
      hold: full,
      stationary: 0,
    },
    { back: 0, delay: 24, hold: full, stationary: 0 },
    { back: 18, delay: 0, hold: full, stationary: 0 },
    { back: 0, delay: 0, hold: full, stationary: 12 },
  ];
  let best:
    | {
        candidate: Candidate;
        elapsed: number;
        inputs: ZoneInput[];
        score: number;
        states: ZoneState[];
      }
    | undefined;
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
    let landedAt: number | undefined;
    const inputs: ZoneInput[] = [];
    const states: ZoneState[] = [];
    for (let tick = 0; tick < limits.horizonTicks; tick++) {
      const input = landedAt === undefined ? action(direction, candidate, tick + elapsed) : IDLE;
      inputs.push(input);
      states.push(predicted);
      predicted = stepZone(tuning, layout, STEP_SECONDS, input, predicted);
      navigation.counters.physicsSteps++;
      if (predicted.death || predicted.turnedBack) {
        safe = false;
        break;
      }
      if (predicted.cleared || predicted.area !== zone.area) {
        break;
      }
      if (airborne && predicted.bird.grounded && landedAt === undefined) {
        landedAt = tick;
      }
      if (landedAt !== undefined && tick - landedAt >= limits.replanTicks) {
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
    const choice = JSON.stringify(candidate);
    for (const failure of bot.navigationMemory?.deaths ?? []) {
      if (
        failure.area === zone.area &&
        failure.choice === choice &&
        failure.phase === currentPhase &&
        Math.abs(failure.x - zone.bird.x) <= tuning.width * 2 &&
        Math.abs(failure.y - zone.bird.y) <= tuning.height
      ) {
        score -= 120;
      }
    }
    if (!best || score > best.score) {
      best = { candidate, elapsed, inputs, score, states };
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
  navigation.decision = {
    area: zone.area,
    choice: JSON.stringify(best.candidate),
    phase: currentPhase,
    x: zone.bird.x,
    y: zone.bird.y,
  };
  const first = best.inputs[0]!;
  const riding = onMover(tuning, layout, zone);
  const boarding =
    !riding &&
    navigation.waypoint !== undefined &&
    layout.areas[zone.area]!.objects.some((object, index) => {
      const at = zone.objects[index] ?? object.origin;
      return (
        (object.collision === "ledge" || object.collision === "solid") &&
        (object.behaviour !== undefined || object.motion.algorithm !== "static") &&
        Math.abs(at.y - navigation.waypoint!.y) < 1 &&
        Math.abs(at.x - navigation.waypoint!.x) < object.width
      );
    });
  navigation.intent =
    first.move === 0
      ? riding
        ? "ride"
        : "wait"
      : first.move !== direction
        ? "recover"
        : first.jumpHeld
          ? riding
            ? "transfer"
            : boarding
              ? "board"
              : "jump"
          : riding
            ? "transfer"
            : "advance";
  navigation.continuation = { candidate: best.candidate, elapsed: best.elapsed + 1 };
  navigation.cache = { config: cacheConfig, index: 1, layout, states: best.states, tuning };
  navigation.queue = best.inputs;
  return navigation.queue.shift()!;
}
