import { STEP_SECONDS } from "../core/index.ts";
import { TILE } from "../data/screen.ts";
import type { ZoneLayout } from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { startZone, stepZone, type ZoneState } from "../rules/zone.ts";
import { botInput, DIAGNOSTIC_SKILL, FORWARD_POLICY, newBot, prepareSensors } from "../sim/bot.ts";
import {
  requiredRouteObservation,
  requiredRouteTargetReached,
  surfaceAt,
  type WalkRouteTarget,
  zoneSurfaces,
} from "../sim/zoneWalk.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import {
  type FlatCrossing,
  prepareRequiredRouteIntent,
  REQUIRED_ROUTE_CONTROLLER,
  requiredRouteIntent,
  type RequiredRouteIntentTarget,
  routeHazardIntent,
  type RouteIntentUnavailable,
  staticRouteAssist,
} from "./requiredRouteIntent.ts";

const ROUTE_TICKS = 600;

type RouteReason =
  | "budget-exhausted"
  | "cleared"
  | "died"
  | "intent-unavailable"
  | "missing-targets"
  | "turned-back";

export interface ContinuousRouteResult {
  readonly assistWitnesses: readonly {
    readonly area: string;
    readonly requiredIndex: number;
    readonly support: string;
    readonly tick: number;
    readonly x: number;
    readonly y: number;
  }[];
  readonly controller: typeof REQUIRED_ROUTE_CONTROLLER;
  readonly missing: readonly { readonly index: number; readonly target: WalkRouteTarget }[];
  readonly reason: RouteReason;
  readonly status: "not-proven" | "proven";
  readonly terminal: {
    readonly area: string;
    readonly cleared: boolean;
    readonly grounded: boolean;
    readonly x: number;
    readonly y: number;
  };
  readonly ticks: number;
  readonly unavailable: RouteIntentUnavailable | undefined;
  readonly witnesses: readonly {
    readonly area: string;
    readonly index: number;
    readonly tick: number;
    readonly x: number;
    readonly y: number;
  }[];
}

// One ordinary continuous trajectory with required-target intent over the native reactive bot.
// Missing witnesses or a policy failure do not establish that the authored geometry is impossible.
export function continuousRequiredRoute(
  layout: ZoneLayout,
  targets: readonly WalkRouteTarget[],
): ContinuousRouteResult {
  const surfaces = zoneSurfaces(ORDINARY, layout);
  const resolved = targets.map((target, index) => ({
    index,
    interval:
      target.xRange === undefined
        ? undefined
        : {
            max: target.xRange.max * TILE,
            min: target.xRange.min * TILE,
          },
    surface: surfaceAt(TILE, surfaces, target.area, target.at),
  }));
  const prepared = prepareRequiredRouteIntent(ORDINARY, resolved);
  let unavailable = "unavailable" in prepared ? prepared.unavailable : undefined;
  const sensors = prepareSensors(layout);
  const bot = newBot(1);
  const witnesses: ContinuousRouteResult["witnesses"][number][] = [];
  const assistWitnesses: ContinuousRouteResult["assistWitnesses"][number][] = [];
  const assisted = new Set<number>();
  let assist: RequiredRouteIntentTarget | undefined;
  let crossing: FlatCrossing | undefined;
  let crossingSteps = 0;
  const seen = new Set<number>();
  const observe = (tick: number, zone: ZoneState) => {
    const observation = requiredRouteObservation(ORDINARY, layout, surfaces, zone);
    if (observation === undefined) {
      return undefined;
    }
    resolved.forEach((target, index) => {
      if (
        !seen.has(index) &&
        requiredRouteTargetReached(target.surface, target.interval, observation)
      ) {
        seen.add(index);
        witnesses.push({ area: zone.area, index, tick, x: zone.bird.x, y: zone.bird.y });
      }
    });
    return observation;
  };
  let zone = startZone(ORDINARY, layout, 1);
  let observation = requiredRouteObservation(ORDINARY, layout, surfaces, zone);
  let ticks = 0;
  while (
    unavailable === undefined &&
    ticks < ROUTE_TICKS &&
    !zone.cleared &&
    zone.death === undefined &&
    !zone.turnedBack
  ) {
    const target =
      "targets" in prepared ? prepared.targets.find(({ index }) => !seen.has(index)) : undefined;
    if (assist?.index !== target?.index) {
      assist = undefined;
    }
    const current = { area: zone.area, bird: zone.bird, support: observation?.support };
    if (
      target !== undefined &&
      assist === undefined &&
      !assisted.has(target.index) &&
      crossing === undefined
    ) {
      const choice = staticRouteAssist(ORDINARY, current, surfaces, target);
      if ("unavailable" in choice) {
        unavailable = choice.unavailable;
        break;
      }
      assist = choice.assist;
    }
    const aim = assist ?? target;
    const refuge =
      "targets" in prepared
        ? prepared.targets.find(
            (candidate) =>
              seen.has(candidate.index) &&
              requiredRouteTargetReached(
                candidate.surface,
                resolved[candidate.index]?.interval,
                observation,
              ),
          )
        : undefined;
    const hazard =
      aim === undefined
        ? { kind: "none" as const }
        : routeHazardIntent(
            ORDINARY,
            layout,
            zone,
            { crossing, crossingSteps, holding: bot.holding, refuge },
            aim,
          );
    if ("unavailable" in hazard) {
      unavailable = hazard.unavailable;
      break;
    }
    if (hazard.kind === "cross") {
      if (crossing === undefined) {
        crossingSteps = 0;
      }
      crossing = hazard.crossing;
    } else {
      crossing = undefined;
      crossingSteps = 0;
    }
    const intent =
      hazard.kind === "cross" || hazard.kind === "hold"
        ? { inhibitNewJump: true, move: hazard.kind === "cross" ? (1 as const) : (0 as const) }
        : aim === undefined
          ? undefined
          : requiredRouteIntent(ORDINARY, current, aim);
    if (intent !== undefined && "unavailable" in intent) {
      unavailable = intent.unavailable;
      break;
    }
    const policy =
      intent === undefined
        ? FORWARD_POLICY
        : {
            jump: intent.inhibitNewJump ? ("never" as const) : ("reactive" as const),
            move: intent.move,
          };
    const input = botInput(ORDINARY, sensors, layout, DIAGNOSTIC_SKILL, policy, zone, bot);
    zone = stepZone(SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, input, zone);
    ticks++;
    observation = observe(ticks, zone);
    if (crossing !== undefined) {
      crossingSteps++;
    }
    if (
      assist !== undefined &&
      requiredRouteTargetReached(assist.surface, undefined, observation)
    ) {
      assistWitnesses.push({
        area: zone.area,
        requiredIndex: assist.index,
        support: assist.surface.key,
        tick: ticks,
        x: zone.bird.x,
        y: zone.bird.y,
      });
      assisted.add(assist.index);
      assist = undefined;
    }
  }
  const missing = targets.flatMap((target, index) => (seen.has(index) ? [] : [{ index, target }]));
  const reason: RouteReason =
    zone.death !== undefined
      ? "died"
      : zone.turnedBack
        ? "turned-back"
        : unavailable !== undefined
          ? "intent-unavailable"
          : !zone.cleared
            ? "budget-exhausted"
            : missing.length > 0
              ? "missing-targets"
              : "cleared";
  return {
    assistWitnesses,
    controller: REQUIRED_ROUTE_CONTROLLER,
    missing,
    reason,
    status: reason === "cleared" ? "proven" : "not-proven",
    terminal: {
      area: zone.area,
      cleared: zone.cleared,
      grounded: zone.bird.grounded,
      x: zone.bird.x,
      y: zone.bird.y,
    },
    ticks,
    unavailable,
    witnesses,
  };
}
