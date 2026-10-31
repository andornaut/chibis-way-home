import { type Random, randomStream } from "@andornaut/game-kit/random";

import type { BirdTuning, Rect, ZoneLayout } from "../data/types";
import { contactBox } from "../rules/behaviour";
import { transientBox } from "../rules/transients";
import type { ZoneInput, ZoneState } from "../rules/zone";
import { hasDynamicBehaviour } from "./behaviourBounds";
import {
  type NavigationConfig,
  type NavigationMemory,
  type NavigationState,
  plannedInput,
} from "./navigation";
export type {
  NavigationConfig,
  NavigationCounters,
  NavigationDiagnostic,
  NavigationMemory,
} from "./navigation";
export {
  NAVIGATION_DEFAULTS,
  NAVIGATION_VALIDATION,
  navigationCounters,
  navigationSnapshot,
  rememberNavigationFailure,
  resetNavigation,
  restoreNavigationMemory,
  validateNavigation,
} from "./navigation";

export interface BotSkill {
  readonly navigation?: Partial<NavigationConfig>;
  readonly adaptiveJump?: boolean;
  readonly maxWaitTicks?: number;
  readonly minJumpHoldTicks?: number;
  readonly waitForMovers?: boolean;
  readonly errorRate: number;
  readonly jumpHoldTicks: number;
  readonly lookAheadPx: number;
  readonly reactionTicks: number;
}
export type JumpPolicy = "continuous" | "never" | "planned" | "reactive";
export interface BotPolicy {
  readonly jump: JumpPolicy;
  readonly move: -1 | 0 | 1;
}

// Mechanical diagnostic settings, not a calibrated model of human play.
export const DIAGNOSTIC_SKILL: BotSkill = {
  adaptiveJump: true,
  errorRate: 0,
  jumpHoldTicks: 24,
  lookAheadPx: 48,
  maxWaitTicks: 120,
  minJumpHoldTicks: 1,
  reactionTicks: 0,
  waitForMovers: true,
};
export const FORWARD_POLICY: BotPolicy = { jump: "reactive", move: 1 };
const CELL = 128;
export interface SensorIndex {
  readonly areas: Readonly<Record<string, ReadonlyMap<number, readonly Rect[]>>>;
  readonly objects: Readonly<Record<string, readonly number[]>>;
  readonly movers: Readonly<Record<string, ReadonlySet<number>>>;
}

export function prepareSensors(layout: ZoneLayout): SensorIndex {
  return {
    areas: Object.fromEntries(
      Object.entries(layout.areas).map(([key, area]) => {
        const cells = new Map<number, Rect[]>();
        for (const rect of area.solids) {
          for (
            let cell = Math.floor(rect.x / CELL);
            cell <= Math.floor((rect.x + rect.width) / CELL);
            cell++
          ) {
            const bucket = cells.get(cell);
            if (bucket) {
              bucket.push(rect);
            } else {
              cells.set(cell, [rect]);
            }
          }
        }
        return [key, cells];
      }),
    ),
    movers: Object.fromEntries(
      Object.entries(layout.areas).map(([key, area]) => [
        key,
        new Set(
          area.objects.flatMap((object, index) =>
            (
              object.behaviour
                ? hasDynamicBehaviour(object.behaviour)
                : object.motion.algorithm !== "static" || object.reaction.kind !== "none"
            )
              ? [index]
              : [],
          ),
        ),
      ]),
    ),
    objects: Object.fromEntries(
      Object.entries(layout.areas).map(([key, area]) => [
        key,
        area.objects.flatMap((object, index) => (object.collision === "none" ? [] : [index])),
      ]),
    ),
  };
}

export interface Bot {
  navigation?: NavigationState;
  navigationMemory?: NavigationMemory;
  readonly random: Random;
  holding: number;
  targetY: number | undefined;
  waited: number;
  noticed: number;
}
export function newBot(seed: number): Bot {
  return {
    holding: 0,
    noticed: 0,
    random: randomStream(seed, "simulation-bot"),
    targetY: undefined,
    waited: 0,
  };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Local probes only. Static terrain is indexed once; moving objects use the real current poses.
function obstacleAhead(
  tuning: BirdTuning,
  sensors: SensorIndex,
  layout: ZoneLayout,
  skill: BotSkill,
  direction: -1 | 1,
  zone: ZoneState,
): { danger: boolean; gap: boolean; height: number; obstacle: boolean; wait: boolean } {
  const bird = zone.bird;
  const front = direction === 1 ? bird.x + tuning.width : bird.x;
  const target = front + direction * skill.lookAheadPx;
  const probe = {
    height: tuning.height - 1,
    width: skill.lookAheadPx,
    x: Math.min(front, target),
    y: bird.y,
  };
  const foot = {
    height: 2,
    width: tuning.width,
    x: target - tuning.width / 2,
    y: bird.y + tuning.height,
  };
  const nearFoot = {
    ...foot,
    x: front + direction * Math.min(tuning.width / 2, skill.lookAheadPx) - tuning.width / 2,
  };
  let supported = false;
  let nearSupported = false;
  let obstacle = false;
  let height = 0;
  let danger = false;
  let movingLanding = false;
  const cells = sensors.areas[zone.area];
  const first = Math.floor(Math.min(probe.x, foot.x) / CELL);
  const last = Math.floor(Math.max(probe.x + probe.width, foot.x + foot.width) / CELL);
  for (let cell = first; cell <= last; cell++) {
    for (const rect of cells?.get(cell) ?? []) {
      if (intersects(probe, rect)) {
        obstacle = true;
        height = Math.max(height, bird.y + tuning.height - rect.y);
      }
      supported ||= intersects(foot, rect);
      nearSupported ||= intersects(nearFoot, rect);
    }
  }
  const area = layout.areas[zone.area];
  if (!area) {
    throw new Error(`Missing area ${zone.area}`);
  }
  for (const index of sensors.objects[zone.area] ?? []) {
    const object = area.objects[index];
    if (!object || object.collision === "none") {
      continue;
    }
    const at = zone.objects[index] ?? object.origin;
    const rect =
      object.collision === "hazard"
        ? contactBox(object, at, zone.behaviours[index]?.facing ?? 1, zone.behaviours[index]?.axis)
        : { ...at, height: object.height, width: object.width };
    if (
      (object.collision === "hazard" || object.collision === "solid") &&
      intersects(probe, rect)
    ) {
      obstacle = true;
      danger ||= object.collision === "hazard";
      height = Math.max(height, bird.y + tuning.height - rect.y);
    }
    if (object.collision === "solid" || object.collision === "ledge") {
      supported ||= intersects(foot, rect);
      nearSupported ||= intersects(nearFoot, rect);
      const distance = direction === 1 ? rect.x - front : front - rect.x - rect.width;
      const reachableHeight =
        rect.y >= bird.y + tuning.height - (tuning.jumpSpeed * tuning.jumpRiseTime) / 2 &&
        rect.y <= bird.y + tuning.height + tuning.height;
      movingLanding ||=
        (sensors.movers[zone.area]?.has(index) ?? false) &&
        distance >= -tuning.width &&
        distance <= skill.lookAheadPx * 2 &&
        reachableHeight;
      if (
        object.collision === "ledge" &&
        rect.y < bird.y + tuning.height &&
        reachableHeight &&
        distance >= 0 &&
        distance <= skill.lookAheadPx
      ) {
        obstacle = true;
        height = Math.max(height, bird.y + tuning.height - rect.y);
      }
    }
  }
  for (const entity of zone.transients) {
    if (entity.age < entity.armSeconds) {
      continue;
    }
    const rect = transientBox(entity);
    if (intersects(probe, rect)) {
      danger = true;
      obstacle = true;
      height = Math.max(height, bird.y + tuning.height - rect.y);
    }
  }
  // A linked edge enters its next section automatically. Missing terrain entirely beyond
  // that edge is not a gap to jump, while hazards and missing support before it still count.
  const link = direction === 1 ? area.walkLinks?.right : area.walkLinks?.left;
  const beyondLink = (rect: Rect) =>
    link !== undefined &&
    (direction === 1 ? rect.x >= area.exitX : rect.x + rect.width <= area.backX);
  supported ||= beyondLink(foot);
  nearSupported ||= beyondLink(nearFoot);
  return {
    danger,
    gap: !supported || !nearSupported,
    height,
    obstacle: obstacle || !supported || !nearSupported,
    wait: !supported && !obstacle && movingLanding,
  };
}

export function botInput(
  tuning: BirdTuning,
  sensors: SensorIndex,
  layout: ZoneLayout,
  skill: BotSkill,
  policy: BotPolicy,
  zone: ZoneState,
  bot: Bot,
): ZoneInput {
  if (policy.jump === "planned" && policy.move !== 0) {
    return plannedInput(tuning, layout, skill.navigation, policy.move, zone, bot);
  }
  if (bot.holding > 0) {
    if (
      skill.adaptiveJump &&
      bot.targetY !== undefined &&
      zone.bird.y + tuning.height <= bot.targetY
    ) {
      bot.holding = 0;
    } else {
      bot.holding--;
      return { jumpHeld: true, move: policy.move, useHeld: false };
    }
  }
  const plan =
    policy.jump === "reactive" && policy.move !== 0
      ? obstacleAhead(tuning, sensors, layout, skill, policy.move, zone)
      : undefined;
  if (
    plan?.wait &&
    skill.waitForMovers &&
    zone.bird.grounded &&
    bot.waited < (skill.maxWaitTicks ?? 0)
  ) {
    bot.waited++;
    bot.noticed = 0;
    return { jumpHeld: false, move: 0, useHeld: false };
  }
  if (!plan?.wait) {
    bot.waited = 0;
  }
  const obstacle = policy.move !== 0 && (policy.jump === "continuous" || (plan?.obstacle ?? false));
  bot.noticed = obstacle ? bot.noticed + 1 : 0;
  const jump =
    policy.jump !== "never" &&
    obstacle &&
    zone.bird.grounded &&
    !zone.bird.jumpHeld &&
    bot.noticed > skill.reactionTicks;
  if (jump && bot.random() >= skill.errorRate) {
    let hold = skill.jumpHoldTicks;
    if (skill.adaptiveJump && plan && !plan.gap && !plan.danger) {
      const minimum = skill.minJumpHoldTicks ?? 1;
      const fullHeight = (tuning.jumpSpeed * tuning.jumpRiseTime) / 2;
      const share = Math.max(
        0,
        Math.min(
          1,
          (plan.height - tuning.jumpHopHeight) / Math.max(1, fullHeight - tuning.jumpHopHeight),
        ),
      );
      hold = minimum + Math.ceil((hold - minimum) * share);
    }
    bot.holding = hold - 1;
    bot.targetY = plan && !plan.gap ? zone.bird.y + tuning.height - plan.height : undefined;
    bot.noticed = 0;
    return { jumpHeld: true, move: policy.move, useHeld: false };
  }
  return { jumpHeld: false, move: policy.move, useHeld: false };
}
