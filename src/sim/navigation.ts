import { STEP_SECONDS } from "../core";
import { SCREEN, TILE } from "../data/screen";
import type { BirdTuning, Rect, ZoneLayout } from "../data/types";
import { contactBox } from "../rules/behaviour";
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
export interface NavigationCandidateSummary {
  readonly executionSteps?: number;
  readonly executionProgress?: number;
  readonly followup?: { readonly inputLabel: string; readonly startTick: number };
  readonly continuationSteps?: number;
  readonly segmentCount?: number;
  readonly elapsed: number;
  readonly forwardProgress: number;
  readonly inputLabel: string;
  readonly physicsSteps: number;
  readonly predictedEndpoint: {
    readonly grounded: boolean;
    readonly x: number;
    readonly y: number;
  };
  readonly rejection: "death" | "wrong-area" | "airborne" | "unsettled-support" | null;
  readonly score: number | null;
  readonly verticalProgress: number;
}
export interface NavigationDiagnostic {
  readonly actualProgress: number;
  readonly area: string;
  readonly cacheMatched: boolean | null;
  readonly cacheRemaining: number;
  readonly candidates: readonly NavigationCandidateSummary[];
  readonly chosenAction: string | null;
  readonly didReplan: boolean;
  readonly intent: NavigationState["intent"];
  readonly origin: {
    readonly x: number;
    readonly y: number;
  };
  readonly predictedProgress: number;
  readonly previousPlan: {
    readonly actualProgress: number;
    readonly predictedProgress: number;
  } | null;
  readonly recovering: boolean;
  readonly reason:
    "search" | "cache-reused" | "cache-diverged" | "context-reset" | "budget-exhausted";
  readonly stalledTicks: number;
  readonly status: NavigationState["status"];
  readonly tick: number;
  readonly waypoint: NavigationState["waypoint"] | null;
}
export interface NavigationState {
  area: string;
  attempt: number;
  cache:
    | {
        config: string;
        index: number;
        layout: ZoneLayout;
        sequenced?: boolean;
        states: readonly ZoneState[];
        tuning: BirdTuning;
      }
    | undefined;
  counters: NavigationCounters;
  decision: FailedChoice | undefined;
  diagnostic?: NavigationDiagnostic;
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
        (!object.orbit &&
          !object.behaviour &&
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
        (!object.orbit && !object.behaviour && object.motion.algorithm === "static")
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
export function navigationSnapshot(bot: Navigator): NavigationDiagnostic | undefined {
  const value = bot.navigation?.diagnostic;
  return value
    ? {
        ...value,
        candidates: value.candidates.slice(0, 8).map((candidate) => ({
          ...candidate,
          ...(candidate.followup && { followup: { ...candidate.followup } }),
          predictedEndpoint: { ...candidate.predictedEndpoint },
        })),
        origin: { ...value.origin },
        previousPlan: value.previousPlan ? { ...value.previousPlan } : null,
        waypoint: value.waypoint ? { ...value.waypoint } : null,
      }
    : undefined;
}
function snapshot(
  context: {
    readonly direction: -1 | 1;
    readonly zone: ZoneState;
    readonly reason: NavigationDiagnostic["reason"];
    readonly didReplan: boolean;
    readonly candidates?: readonly NavigationCandidateSummary[];
    readonly predictedProgress?: number;
    readonly chosenAction?: string | null;
  },
  navigation: NavigationState,
): void {
  const { candidates, chosenAction, didReplan, direction, predictedProgress, reason, zone } =
    context;
  const previous = navigation.diagnostic;
  const origin = didReplan
    ? { x: zone.bird.x, y: zone.bird.y }
    : (previous?.origin ?? { x: zone.bird.x, y: zone.bird.y });
  navigation.diagnostic = {
    actualProgress: direction * (zone.bird.x - origin.x),
    area: zone.area,
    cacheMatched: reason === "cache-reused" ? true : reason === "cache-diverged" ? false : null,
    cacheRemaining: navigation.queue.length,
    candidates: candidates ?? previous?.candidates ?? [],
    chosenAction: chosenAction === undefined ? (previous?.chosenAction ?? null) : chosenAction,
    didReplan,
    intent: navigation.intent,
    origin,
    predictedProgress: predictedProgress ?? previous?.predictedProgress ?? 0,
    previousPlan:
      didReplan && previous
        ? {
            actualProgress: direction * (zone.bird.x - previous.origin.x),
            predictedProgress: previous.predictedProgress,
          }
        : (previous?.previousPlan ?? null),
    reason,
    recovering: navigation.intent === "recover",
    stalledTicks: navigation.stalledTicks,
    status: navigation.status,
    tick: zone.steps,
    waypoint: navigation.waypoint ?? null,
  };
}
function inputLabel(candidate: Candidate): string {
  if (candidate.jumpAt !== undefined) {
    return "run-up-full";
  }
  if (candidate.travel !== undefined) {
    return candidate.stopAt === undefined ? "backward-full" : "retreat-to-support";
  }
  if (candidate.stopAt !== undefined) {
    return candidate.hold === 0 ? "approach" : "brake-full";
  }
  if (candidate.back > 0) {
    return "back-then-full";
  }
  if (candidate.delay > 0) {
    return "wait-then-full";
  }
  if (candidate.stationary === Number.MAX_SAFE_INTEGER) {
    return "wait";
  }
  if (candidate.stationary > 0) {
    return "stationary-then-full";
  }
  return candidate.hold === 0 ? "walk" : candidate.hold === 1 ? "tap" : "full";
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
function supports(layout: ZoneLayout, zone: ZoneState): Rect[] {
  const area = layout.areas[zone.area]!;
  const result: Rect[] = [...area.solids];
  area.objects.forEach((object, index) => {
    if (object.collision === "ledge" || object.collision === "solid") {
      result.push({
        ...(zone.objects[index] ?? object.origin),
        height: object.height,
        width: object.width,
      });
    }
  });
  return result;
}
// Static lethal bands remove only the landing spans their contact boxes cover.
function landingSurfaces(tuning: BirdTuning, layout: ZoneLayout, zone: ZoneState): Rect[] {
  const hazards = layout.areas[zone.area]!.objects.filter(
    (object) =>
      object.collision === "hazard" &&
      !object.orbit &&
      !object.behaviour &&
      object.motion.algorithm === "static" &&
      object.reaction.kind === "none",
  ).map((object) => contactBox(object, object.origin, 1));
  return supports(layout, zone).flatMap((surface) => {
    let spans = [surface];
    for (const hazard of hazards) {
      if (hazard.y >= surface.y || hazard.y + hazard.height <= surface.y - tuning.height) {
        continue;
      }
      spans = spans.flatMap((span) => {
        const left = Math.max(span.x, hazard.x),
          right = Math.min(span.x + span.width, hazard.x + hazard.width);
        if (left >= right) {
          return [span];
        }
        return [
          ...(left > span.x ? [{ ...span, width: left - span.x }] : []),
          ...(right < span.x + span.width
            ? [{ ...span, width: span.x + span.width - right, x: right }]
            : []),
        ];
      });
    }
    return spans.filter((span) => span.width >= tuning.width);
  });
}
// The nearest blocking face selects a local support goal; every action still needs real-rule validation.
function waypoint(tuning: BirdTuning, layout: ZoneLayout, direction: -1 | 1, zone: ZoneState) {
  const area = layout.areas[zone.area]!;
  const surfaces = landingSurfaces(tuning, layout, zone);
  const foot = zone.bird.y + tuning.height,
    front = zone.bird.x + (direction === 1 ? tuning.width : 0);
  const distance = (rect: Rect) => (direction === 1 ? rect.x - front : front - rect.x - rect.width);
  // An explicit upper exit is an objective even when its stairs do not block walking below.
  const exit = layout.stageExit?.area === zone.area ? layout.stageExit.rect : undefined;
  if (exit && Math.abs(exit.x - front) <= SCREEN.width && exit.y + exit.height < foot) {
    const fullHeight = tuning.jumpSpeed ** 2 / (2 * tuning.gravity);
    const ascending = surfaces
      .filter((rect) => {
        const centre = rect.x + (rect.width - tuning.width) / 2;
        return (
          rect.y < foot - 2 &&
          foot - rect.y <= fullHeight &&
          Math.abs(centre - zone.bird.x) <= SCREEN.width / 2 &&
          Math.abs(centre - exit.x) < Math.abs(zone.bird.x - exit.x) + tuning.width
        );
      })
      .sort((a, b) => Math.abs(distance(a)) - Math.abs(distance(b)))[0];
    if (ascending) {
      return { width: ascending.width, x: ascending.x, y: ascending.y };
    }
    if (foot - exit.y - exit.height <= fullHeight) {
      return { width: exit.width, x: exit.x, y: exit.y + exit.height };
    }
  }
  const nearby = surfaces
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
function approachEdge(tuning: BirdTuning, layout: ZoneLayout, direction: -1 | 1, zone: ZoneState) {
  if (!zone.bird.grounded) {
    return undefined;
  }
  const foot = zone.bird.y + tuning.height;
  const support = supports(layout, zone)
    .filter(
      (rect) =>
        Math.abs(rect.y - foot) < 1 &&
        rect.x < zone.bird.x + tuning.width &&
        rect.x + rect.width > zone.bird.x,
    )
    .sort(
      (a, b) =>
        direction * (b.x + (direction === 1 ? b.width : 0) - a.x - (direction === 1 ? a.width : 0)),
    )[0];
  if (!support) {
    return undefined;
  }
  const edge = support.x + (direction === 1 ? support.width : 0);
  let target = edge - (direction * tuning.width) / 2;
  for (const object of layout.areas[zone.area]!.objects) {
    if (
      object.collision !== "hazard" ||
      object.orbit ||
      object.behaviour ||
      object.contact ||
      object.motion.algorithm !== "static" ||
      object.reaction.kind !== "none"
    ) {
      continue;
    }
    const box = contactBox(object, object.origin, 1);
    if (box.y >= foot || box.y + box.height < foot - 1) {
      continue;
    }
    const front = direction === 1 ? box.x : box.x + box.width;
    if (
      direction * (front - zone.bird.x - (direction === 1 ? tuning.width : 0)) < 0 ||
      direction * (front - edge) > 0
    ) {
      continue;
    }
    const safe = front - (direction === 1 ? tuning.width + 2 : -2);
    target = direction === 1 ? Math.min(target, safe) : Math.max(target, safe);
  }
  return target;
}
function followupHold(
  tuning: BirdTuning,
  layout: ZoneLayout,
  direction: -1 | 1,
  full: number,
  zone: ZoneState,
): number {
  const next = waypoint(tuning, layout, direction, zone);
  const rise = next ? Math.max(0, zone.bird.y + tuning.height - next.y) : 0;
  const area = layout.areas[zone.area]!;
  const ceilings = [
    ...area.solids,
    ...area.objects.flatMap((object, index) =>
      object.collision === "solid"
        ? [
            contactBox(
              object,
              zone.objects[index] ?? object.origin,
              zone.behaviours[index]?.facing ?? 1,
              zone.behaviours[index]?.axis,
            ),
          ]
        : [],
    ),
  ];
  const clearance = Math.min(
    Infinity,
    ...ceilings
      .filter(
        (rect) =>
          rect.y + rect.height <= zone.bird.y &&
          rect.x < zone.bird.x + tuning.width &&
          rect.x + rect.width > zone.bird.x,
      )
      .map((rect) => zone.bird.y - rect.y - rect.height),
  );
  if (clearance < tuning.jumpHopHeight) {
    return 0;
  }
  if (clearance < (tuning.jumpSpeed * tuning.jumpRiseTime) / 2) {
    const front = zone.bird.x + (direction === 1 ? tuning.width : 0);
    const foot = zone.bird.y + tuning.height;
    const hopTravel = tuning.walkSpeed * 2 * Math.sqrt((2 * tuning.jumpHopHeight) / tuning.gravity);
    const footHazard = area.objects.some((object, index) => {
      if (
        object.collision !== "hazard" ||
        object.orbit ||
        object.behaviour ||
        object.motion.algorithm !== "static"
      ) {
        return false;
      }
      const box = contactBox(object, zone.objects[index] ?? object.origin, 1);
      const ahead = direction === 1 ? box.x - front : front - box.x - box.width;
      return box.y < foot && box.y + box.height >= foot - 1 && ahead >= 0 && ahead <= hopTravel;
    });
    return (rise > 0 && rise <= tuning.jumpHopHeight) || footHazard ? 1 : 0;
  }
  return rise > tuning.jumpHopHeight || rise === 0 ? full : 1;
}
// A supported run-up clears a low ceiling or uses the remaining physical takeoff span.
function runningTakeoff(
  tuning: BirdTuning,
  layout: ZoneLayout,
  direction: -1 | 1,
  approach: number | undefined,
  zone: ZoneState,
): number | undefined {
  if (!zone.bird.grounded) {
    return undefined;
  }
  const stepTravel = tuning.walkSpeed * STEP_SECONDS;
  const fullHeight = (tuning.jumpSpeed * tuning.jumpRiseTime) / 2;
  const ceiling = layout.areas[zone.area]!.solids.filter(
    (rect) =>
      rect.x < zone.bird.x + tuning.width &&
      rect.x + rect.width > zone.bird.x &&
      rect.y + rect.height <= zone.bird.y &&
      zone.bird.y - rect.y - rect.height < fullHeight,
  )
    .map((rect) =>
      direction === 1 ? rect.x + rect.width + stepTravel : rect.x - tuning.width - stepTravel,
    )
    .sort((a, b) => direction * (b - a))[0];
  if (ceiling !== undefined) {
    const obstruction = layout.areas[zone.area]!.objects.flatMap((object, index) =>
      object.collision === "hazard"
        ? [
            contactBox(
              object,
              zone.objects[index] ?? object.origin,
              zone.behaviours[index]?.facing ?? 1,
            ),
          ]
        : [],
    )
      .filter(
        (rect) =>
          rect.y < zone.bird.y + tuning.height &&
          rect.y + rect.height > zone.bird.y &&
          direction * (rect.x + rect.width / 2 - zone.bird.x - tuning.width / 2) > 0,
      )
      .sort((a, b) => direction * (a.x - b.x))[0];
    const apexAligned =
      obstruction === undefined
        ? ceiling
        : obstruction.x +
          (obstruction.width - tuning.width) / 2 -
          direction * tuning.walkSpeed * tuning.jumpRiseTime;
    return direction === 1 ? Math.max(ceiling, apexAligned) : Math.min(ceiling, apexAligned);
  }
  if (approach === undefined || Math.abs(zone.bird.x - approach) > stepTravel) {
    return undefined;
  }
  const support = supports(layout, zone).find(
    (rect) =>
      Math.abs(rect.y - zone.bird.y - tuning.height) < 1 &&
      rect.x < zone.bird.x + tuning.width &&
      rect.x + rect.width > zone.bird.x &&
      Math.abs(
        approach -
          (direction === 1 ? rect.x + rect.width - tuning.width / 2 : rect.x - tuning.width / 2),
      ) <= stepTravel,
  );
  if (support === undefined) {
    return undefined;
  }
  const edge = support.x + (direction === 1 ? support.width : 0);
  const canLandAhead = landingSurfaces(tuning, layout, zone).some((rect) => {
    const distance = direction * (rect.x + (direction === 1 ? 0 : rect.width) - edge);
    return (
      distance > 0 &&
      distance <= 2 * tuning.walkSpeed * tuning.jumpRiseTime + tuning.width &&
      support.y - rect.y <= fullHeight
    );
  });
  if (!canLandAhead) {
    return undefined;
  }
  return direction === 1
    ? support.x + support.width - stepTravel
    : support.x - tuning.width + stepTravel;
}
interface Candidate {
  readonly jumpAt?: number;
  readonly stopAt?: number | undefined;
  readonly travel?: -1 | 1;
  readonly back: number;
  readonly delay: number;
  readonly hold: number;
  readonly stationary: number;
}
function action(
  tuning: BirdTuning,
  direction: -1 | 1,
  candidate: Candidate,
  tick: number,
  zone: ZoneState,
): ZoneInput {
  if (tick < candidate.back) {
    return { ...IDLE, move: direction === 1 ? -1 : 1 };
  }
  const active = tick - candidate.back - candidate.delay;
  if (active < 0) {
    return IDLE;
  }
  const travel = candidate.travel ?? direction;
  if (candidate.jumpAt !== undefined) {
    const launching = travel * (zone.bird.x - candidate.jumpAt) >= 0;
    return {
      jumpHeld:
        launching &&
        (zone.bird.jumpHeld
          ? zone.bird.jumpHeldFor < tuning.jumpRiseTime + STEP_SECONDS
          : zone.bird.grounded),
      move: travel,
      useHeld: false,
    };
  }
  if (candidate.stopAt !== undefined) {
    const remaining = travel * (candidate.stopAt - zone.bird.x);
    const braking =
      (zone.bird.vx * zone.bird.vx) / (2 * tuning.brakeAccel) +
      Math.abs(zone.bird.vx) * STEP_SECONDS +
      2;
    return {
      jumpHeld: active < candidate.hold,
      move: remaining > braking ? travel : 0,
      useHeld: false,
    };
  }
  return {
    jumpHeld: active < candidate.hold,
    move: active < candidate.stationary ? 0 : travel,
    useHeld: false,
  };
}
function policyKey(
  direction: -1 | 1,
  horizon: number,
  elapsed: number,
  candidate: Candidate,
): string {
  return JSON.stringify([
    candidate.travel !== undefined,
    candidate.jumpAt,
    Array.from({ length: horizon }, (_, tick) => {
      const at = tick + elapsed;
      if (at < candidate.back) {
        return [false, -direction];
      }
      const active = at - candidate.back - candidate.delay;
      if (active < 0) {
        return [false, 0];
      }
      const held = active < candidate.hold;
      const travel = candidate.travel ?? direction;
      return candidate.stopAt === undefined
        ? [held, active < candidate.stationary ? 0 : travel]
        : [held, "brake", travel, candidate.stopAt];
    }),
  ]);
}
function threats(tuning: BirdTuning, layout: ZoneLayout, zone: ZoneState) {
  const sideThreat = layout.areas[zone.area]!.objects.some((object, index) => {
    if (
      object.collision !== "hazard" ||
      object.orbit ||
      object.behaviour ||
      object.motion.algorithm !== "static"
    ) {
      return false;
    }
    const box = contactBox(object, zone.objects[index] ?? object.origin, 1);
    return (
      box.height > tuning.jumpHopHeight &&
      box.width < box.height &&
      box.y < zone.bird.y + tuning.height &&
      box.y + box.height > zone.bird.y &&
      Math.abs(box.x - zone.bird.x) <= tuning.width * 2
    );
  });
  const threatened =
    sideThreat ||
    layout.areas[zone.area]!.objects.some(
      (object, index) =>
        object.collision === "hazard" &&
        (object.orbit ||
          object.behaviour ||
          object.motion.algorithm !== "static" ||
          object.reaction.kind !== "none") &&
        Math.abs((zone.objects[index] ?? object.origin).x - zone.bird.x) <= SCREEN.width / 2,
    );
  return { nearby: threatened, side: sideThreat };
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
  let reason: NavigationDiagnostic["reason"] = "search";
  if (navigation.area !== zone.area || navigation.attempt !== zone.attempt) {
    resetNavigation(bot);
    navigation.area = zone.area;
    navigation.attempt = zone.attempt;
    navigation.stalledTicks = 0;
    reason = "context-reset";
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
      const input = navigation.queue.shift()!;
      if (
        !cache.sequenced &&
        navigation.stalledTicks >= limits.replanTicks &&
        cache.index % limits.replanTicks === 0 &&
        (navigation.diagnostic?.predictedProgress ?? 0) <= 0
      ) {
        navigation.queue = [];
        navigation.continuation = undefined;
      }
      snapshot({ didReplan: false, direction, reason: "cache-reused", zone }, navigation);
      return input;
    }
    resetNavigation(bot);
    reason = "cache-diverged";
  }
  if (navigation.counters.physicsSteps >= limits.maxPhysicsSteps) {
    if (navigation.status !== "budget-exhausted") {
      navigation.counters.budgetExhaustions++;
    }
    navigation.status = "budget-exhausted";
    navigation.queue = [];
    snapshot({ didReplan: false, direction, reason: "budget-exhausted", zone }, navigation);
    return IDLE;
  }
  navigation.counters.decisions++;
  navigation.waypoint = waypoint(tuning, layout, direction, zone);
  const { nearby: threatened, side: sideThreat } = threats(tuning, layout, zone);
  const movingSupport = layout.areas[zone.area]!.objects.some(
    (object, index) =>
      (object.collision === "ledge" || object.collision === "solid") &&
      (object.orbit ||
        object.behaviour ||
        object.motion.algorithm !== "static" ||
        object.reaction.kind !== "none") &&
      Math.abs((zone.objects[index] ?? object.origin).x - zone.bird.x) <= SCREEN.width / 2,
  );
  const needsStability = threatened || (limits.profile === "validation" && movingSupport);
  const currentPhase = phase(layout, zone);
  const full = Math.ceil(tuning.jumpRiseTime / STEP_SECONDS) + 1;
  const approach = approachEdge(tuning, layout, direction, zone);
  const refugeX =
    navigation.waypoint?.width === undefined
      ? undefined
      : navigation.waypoint.x + (navigation.waypoint.width - tuning.width) / 2;
  const retreat: Candidate | undefined =
    zone.bird.grounded &&
    refugeX !== undefined &&
    direction * (refugeX - zone.bird.x) < -tuning.width &&
    navigation.waypoint!.y < zone.bird.y + tuning.height
      ? {
          back: 0,
          delay: 0,
          hold: 0,
          stationary: 0,
          stopAt: refugeX,
          travel: direction === 1 ? -1 : 1,
        }
      : undefined;
  const reverseEdge = threatened
    ? approachEdge(tuning, layout, direction === 1 ? -1 : 1, zone)
    : undefined;
  const backwardColumn = layout.areas[zone.area]!.objects.flatMap((object, index) => {
    if (object.collision !== "hazard" || !object.behaviour) {
      return [];
    }
    const box = contactBox(
      object,
      zone.objects[index] ?? object.origin,
      zone.behaviours[index]?.facing ?? 1,
      zone.behaviours[index]?.axis,
    );
    if (box.x >= zone.bird.x + tuning.width || box.x + box.width <= zone.bird.x) {
      return [];
    }
    return [direction === 1 ? box.x - tuning.width - 2 : box.x + box.width + 2];
  }).sort((a, b) => direction * (b - a))[0];
  const groundTarget =
    reverseEdge === undefined
      ? undefined
      : direction === 1
        ? Math.max(reverseEdge, backwardColumn ?? zone.bird.x - tuning.width * 2)
        : Math.min(reverseEdge, backwardColumn ?? zone.bird.x + tuning.width * 2);
  const reverseSupport =
    sideThreat && zone.bird.grounded
      ? landingSurfaces(tuning, layout, zone)
          .filter((rect) => {
            const centre = rect.x + (rect.width - tuning.width) / 2;
            const rise = zone.bird.y + tuning.height - rect.y;
            return (
              direction * (centre - zone.bird.x) < -tuning.width &&
              Math.abs(centre - zone.bird.x) <= SCREEN.width / 2 &&
              rise > 0 &&
              rise <= (tuning.jumpSpeed * tuning.jumpRiseTime) / 2
            );
          })
          .sort(
            (a, b) =>
              Math.abs(a.x + (a.width - tuning.width) / 2 - zone.bird.x) -
              Math.abs(b.x + (b.width - tuning.width) / 2 - zone.bird.x),
          )[0]
      : undefined;
  const groundEscape: Candidate | undefined = reverseSupport
    ? {
        back: 0,
        delay: 0,
        hold: full,
        stationary: 0,
        stopAt: reverseSupport.x + (reverseSupport.width - tuning.width) / 2,
        travel: direction === 1 ? -1 : 1,
      }
    : groundTarget === undefined
      ? undefined
      : (retreat ?? {
          back: 0,
          delay: 0,
          hold: 0,
          stationary: 0,
          stopAt: groundTarget,
          travel: direction === 1 ? -1 : 1,
        });
  const candidates: Candidate[] = [
    { back: 0, delay: 0, hold: 0, stationary: 0 },
    { back: 0, delay: 0, hold: 1, stationary: 0 },
    { back: 0, delay: 0, hold: full, stationary: 0 },
    { back: 0, delay: 0, hold: 0, stationary: Number.MAX_SAFE_INTEGER },
    {
      back: 0,
      delay: 0,
      hold: full,
      stationary: 0,
      stopAt:
        navigation.waypoint?.width === undefined
          ? undefined
          : navigation.waypoint.x + (navigation.waypoint.width - tuning.width) / 2,
    },
    { back: 0, delay: 24, hold: full, stationary: 0 },
    threatened
      ? { back: 0, delay: 0, hold: full, stationary: 0, travel: direction === 1 ? -1 : 1 }
      : (retreat ?? { back: 18, delay: 0, hold: full, stationary: 0 }),
    approach === undefined
      ? { back: 0, delay: 0, hold: full, stationary: 12 }
      : { back: 0, delay: 0, hold: 0, stationary: 0, stopAt: approach },
  ];
  const jumpAt = runningTakeoff(tuning, layout, direction, approach, zone);
  if (jumpAt !== undefined) {
    candidates.splice(3, 0, { back: 0, delay: 0, hold: full, jumpAt, stationary: 0 });
  }
  let best:
    | {
        candidate: Candidate;
        elapsed: number;
        executionSteps: number;
        inputs: ZoneInput[];
        predictedProgress: number;
        score: number;
        sequenced: boolean;
        states: ZoneState[];
      }
    | undefined;
  let recovery: typeof best;
  let safeForward = false;
  const summaries: NavigationCandidateSummary[] = [];
  if (approach !== undefined) {
    candidates.splice(4, 0, candidates.pop()!);
  }
  if (groundEscape) {
    candidates.unshift(groundEscape);
  }
  if (retreat && !threatened) {
    candidates.splice(4, 0, candidates.splice(candidates.indexOf(retreat), 1)[0]!);
  }
  if (threatened) {
    candidates.sort((a, b) => Number(b.travel !== undefined) - Number(a.travel !== undefined));
  }
  const choices = candidates.map((candidate) => ({ candidate, elapsed: 0 }));
  if (navigation.continuation) {
    choices.splice(threatened ? 2 : 0, 0, navigation.continuation);
  }
  const seen = new Set<string>();
  const distinct = choices.filter(({ candidate, elapsed }) => {
    const key = policyKey(direction, limits.horizonTicks, elapsed, candidate);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  for (const { candidate, elapsed } of distinct.slice(0, limits.maxCandidates)) {
    if (navigation.counters.physicsSteps + limits.horizonTicks > limits.maxPhysicsSteps) {
      break;
    }
    navigation.counters.candidateRollouts++;
    let predicted = zone;
    let safe = true;
    let airborne = !zone.bird.grounded;
    let landedAt: number | undefined;
    let groundedContinuation = false;
    let followup: Candidate | undefined;
    let followupStart = 0;
    let jumped = false;
    let endTick = limits.horizonTicks * (limits.profile === "validation" ? 2 : 1);
    const inputs: ZoneInput[] = [];
    const states: ZoneState[] = [];
    for (let tick = 0; tick < endTick; tick++) {
      if (
        limits.profile === "quick" &&
        candidate.jumpAt !== undefined &&
        tick > 0 &&
        !jumped &&
        predicted.bird.grounded &&
        direction * (predicted.bird.x - candidate.jumpAt) >= 0
      ) {
        break;
      }
      if (
        !followup &&
        limits.profile === "validation" &&
        threatened &&
        candidate.travel === undefined &&
        predicted.bird.grounded &&
        tick > 0 &&
        tick <= limits.horizonTicks &&
        ((jumped && landedAt !== undefined) || tick === limits.horizonTicks) &&
        threats(tuning, layout, predicted).nearby
      ) {
        const next = waypoint(tuning, layout, direction, predicted);
        followup = {
          back: 0,
          delay: 0,
          hold: followupHold(tuning, layout, direction, full, predicted),
          stationary: 0,
          stopAt: next?.width === undefined ? undefined : next.x + (next.width - tuning.width) / 2,
        };
        followupStart = tick;
        endTick = Math.min(endTick, tick + limits.horizonTicks);
        landedAt = undefined;
        airborne = false;
        jumped = false;
      }
      if (!followup && tick === limits.horizonTicks) {
        groundedContinuation =
          limits.profile === "validation" && needsStability && predicted.bird.grounded;
        if (
          !groundedContinuation &&
          (predicted.bird.grounded ||
            (candidate.travel ?? direction) * (predicted.bird.x - zone.bird.x) <= 0)
        ) {
          break;
        }
      }
      if (navigation.counters.physicsSteps >= limits.maxPhysicsSteps) {
        break;
      }
      const guard =
        needsStability &&
        predicted.bird.grounded &&
        tick >= (followup ? endTick : limits.horizonTicks) - limits.replanTicks * 2;
      const input =
        followup && tick === followupStart
          ? IDLE
          : landedAt === undefined && !guard && !groundedContinuation
            ? action(
                tuning,
                direction,
                followup ?? candidate,
                followup ? tick - followupStart - 1 : tick + elapsed,
                predicted,
              )
            : IDLE;
      inputs.push(input);
      states.push(predicted);
      predicted = stepZone(tuning, layout, STEP_SECONDS, input, predicted);
      navigation.counters.physicsSteps++;
      jumped ||= input.jumpHeld && predicted.bird.vy < 0;
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
      if (
        !needsStability &&
        landedAt !== undefined &&
        tick - landedAt >= limits.replanTicks &&
        predicted.bird.grounded
      ) {
        break;
      }
      airborne ||= !predicted.bird.grounded;
    }
    const forwardArea =
      layout.areas[zone.area]!.walkLinks?.[direction === 1 ? "right" : "left"]?.area;
    const rejection: NavigationCandidateSummary["rejection"] = !safe
      ? "death"
      : predicted.area !== zone.area && predicted.area !== forwardArea
        ? "wrong-area"
        : !predicted.bird.grounded && !predicted.cleared && predicted.area === zone.area
          ? "airborne"
          : limits.profile === "validation" &&
              !predicted.cleared &&
              (needsStability || onMover(tuning, layout, predicted)) &&
              Math.abs(predicted.bird.vx) > 1e-6
            ? "unsettled-support"
            : null;
    const landingPrefix =
      landedAt !== undefined && landedAt >= limits.horizonTicks
        ? Math.min(inputs.length, landedAt + 2)
        : inputs.length;
    const prefixState = states[landingPrefix] ?? predicted;
    const executionSteps =
      prefixState.bird.grounded &&
      (!onMover(tuning, layout, prefixState) || Math.abs(prefixState.bird.vx) <= 1e-6)
        ? landingPrefix
        : inputs.length;
    const executionEnd = states[executionSteps] ?? predicted;
    const executionProgress = direction * (executionEnd.bird.x - zone.bird.x);
    const summary: NavigationCandidateSummary = {
      continuationSteps: Math.max(
        0,
        inputs.length - (followup ? followupStart : limits.horizonTicks),
      ),
      ...(followup && { followup: { inputLabel: inputLabel(followup), startTick: followupStart } }),
      elapsed,
      executionProgress,
      executionSteps,
      forwardProgress: direction * (predicted.bird.x - zone.bird.x),
      inputLabel: inputLabel(candidate),
      physicsSteps: inputs.length,
      predictedEndpoint: {
        grounded: predicted.bird.grounded,
        x: predicted.bird.x,
        y: predicted.bird.y,
      },
      rejection,
      score: null,
      segmentCount: followup || inputs.length > limits.horizonTicks ? 2 : 1,
      verticalProgress: zone.bird.y - predicted.bird.y,
    };
    summaries.push(summary);
    if (rejection !== null) {
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
    safeForward ||= candidate.travel === undefined && summary.forwardProgress > 0;
    // Recovery is selected after every forward candidate has been evaluated.
    if (candidate.travel !== undefined) {
      score +=
        candidate.stopAt === undefined
          ? 2 * Math.abs(summary.forwardProgress)
          : 2 *
            (Math.abs(candidate.stopAt - zone.bird.x) -
              Math.abs(candidate.stopAt - predicted.bird.x));
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
    summaries[summaries.length - 1] = { ...summary, score };
    const previous = candidate.travel === undefined ? best : recovery;
    // A validated support target retains a foothold instead of rewarding a longer blind retreat.
    const targetedRecovery = candidate.travel !== undefined && candidate.stopAt !== undefined;
    const previousTargetedRecovery = previous?.candidate.stopAt !== undefined;
    if (
      !previous ||
      (movingSupport &&
      navigation.waypoint !== undefined &&
      candidate.travel !== undefined &&
      targetedRecovery !== previousTargetedRecovery
        ? targetedRecovery
        : score > previous.score)
    ) {
      const selected = {
        candidate,
        elapsed,
        executionSteps,
        inputs,
        predictedProgress: executionProgress,
        score,
        sequenced: followup !== undefined,
        states,
      };
      if (candidate.travel === undefined) {
        best = selected;
      } else {
        recovery = selected;
      }
    }
  }
  if (!safeForward && recovery && (!best || recovery.score > best.score)) {
    best = recovery;
  }
  if (!best) {
    navigation.status =
      navigation.counters.physicsSteps + limits.horizonTicks > limits.maxPhysicsSteps
        ? "budget-exhausted"
        : "no-safe-candidate";
    if (navigation.status === "budget-exhausted") {
      navigation.counters.budgetExhaustions++;
    }
    snapshot(
      {
        candidates: summaries,
        chosenAction: null,
        didReplan: true,
        direction,
        predictedProgress: 0,
        reason,
        zone,
      },
      navigation,
    );
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
        (object.orbit !== undefined ||
          object.behaviour !== undefined ||
          object.motion.algorithm !== "static") &&
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
  navigation.continuation =
    best.sequenced || best.executionSteps < best.inputs.length
      ? undefined
      : { candidate: best.candidate, elapsed: best.elapsed + 1 };
  navigation.cache = {
    config: cacheConfig,
    index: 1,
    layout,
    sequenced: best.sequenced,
    states: best.states,
    tuning,
  };
  navigation.queue = best.inputs.slice(0, best.executionSteps);
  const input = navigation.queue.shift()!;
  snapshot(
    {
      candidates: summaries,
      chosenAction: inputLabel(best.candidate),
      didReplan: true,
      direction,
      predictedProgress: best.predictedProgress,
      reason,
      zone,
    },
    navigation,
  );
  return input;
}
