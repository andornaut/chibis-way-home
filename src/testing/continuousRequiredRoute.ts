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

const ROUTE_TICKS = 600;

type RouteReason = "budget-exhausted" | "cleared" | "died" | "missing-targets" | "turned-back";

export interface ContinuousRouteResult {
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
  readonly witnesses: readonly {
    readonly area: string;
    readonly index: number;
    readonly tick: number;
    readonly x: number;
    readonly y: number;
  }[];
}

// One ordinary continuous entry-to-exit trajectory with the existing observable reactive bot.
// Missing witnesses or a policy failure do not establish that the authored geometry is impossible.
export function continuousRequiredRoute(
  layout: ZoneLayout,
  targets: readonly WalkRouteTarget[],
): ContinuousRouteResult {
  const surfaces = zoneSurfaces(ORDINARY, layout);
  const resolved = targets.map((target) => ({
    interval:
      target.xRange === undefined
        ? undefined
        : {
            max: target.xRange.max * TILE,
            min: target.xRange.min * TILE,
          },
    surface: surfaceAt(TILE, surfaces, target.area, target.at),
  }));
  const sensors = prepareSensors(layout);
  const bot = newBot(1);
  const witnesses: ContinuousRouteResult["witnesses"][number][] = [];
  const seen = new Set<number>();
  const observe = (tick: number, zone: ZoneState) => {
    const observation = requiredRouteObservation(ORDINARY, layout, surfaces, zone);
    if (observation === undefined) {
      return;
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
  };
  let zone = startZone(ORDINARY, layout, 1);
  let ticks = 0;
  while (ticks < ROUTE_TICKS && !zone.cleared && zone.death === undefined && !zone.turnedBack) {
    const input = botInput(ORDINARY, sensors, layout, DIAGNOSTIC_SKILL, FORWARD_POLICY, zone, bot);
    zone = stepZone(SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, input, zone);
    ticks++;
    observe(ticks, zone);
  }
  const missing = targets.flatMap((target, index) => (seen.has(index) ? [] : [{ index, target }]));
  const reason: RouteReason =
    zone.death !== undefined
      ? "died"
      : zone.turnedBack
        ? "turned-back"
        : !zone.cleared
          ? "budget-exhausted"
          : missing.length > 0
            ? "missing-targets"
            : "cleared";
  return {
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
    witnesses,
  };
}
