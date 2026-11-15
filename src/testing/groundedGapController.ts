import { EDGE, rectAt, STEP_SECONDS } from "../core/index.ts";
import type { BirdTuning, Rect, ZoneLayout } from "../data/types/index.ts";
import { ordinaryHorizontalVelocity } from "../rules/bird.ts";
import { standsOn, type ZoneInput, type ZoneState } from "../rules/zone.ts";
import { requiredRouteObservation, type Surface, zoneSurfaces } from "../sim/zoneWalk.ts";
import type { QualificationController } from "./continuousRequiredRoute.ts";
import type { RequiredRouteIntentTarget } from "./requiredRouteIntent.ts";
export const GROUNDED_GAP_CONTROLLER = "required-route-grounded-gap-v1";
type Phase = "approach" | "press" | "ascent" | "fall";
export interface GapEvent {
  readonly tick: number;
  readonly kind:
    "apex" | "takeoff" | "release" | "first-fall" | "landing" | "death" | "interrupted";
  readonly input: ZoneInput;
  readonly before: GapFrame;
  readonly after: GapFrame;
}
interface GapFrame {
  readonly area: string;
  readonly bird: ZoneState["bird"];
  readonly body: Rect;
  readonly support: Surface | undefined;
  readonly ceiling: readonly Rect[];
  readonly wall: readonly Rect[];
  readonly death: ZoneState["death"];
}
// Only current contact geometry is observed; no future state or jump trajectory is sampled.
export function createGroundedGapController(tuning: BirdTuning, layout: ZoneLayout) {
  const events: GapEvent[] = [];
  const surfaces = zoneSurfaces(tuning, layout);
  let active:
    | {
        readonly from: Surface;
        readonly target: RequiredRouteIntentTarget;
        phase: Phase;
      }
    | undefined;
  let failure: "interrupted" | "unsupported" | undefined;
  let released = false;
  let fell = false;
  const frame = (zone: ZoneState): GapFrame => {
    const bird = { ...zone.bird };
    const body = { height: tuning.height, width: tuning.width, x: bird.x, y: bird.y };
    const area = layout.areas[zone.area];
    const solids = [
      ...(area?.solids ?? []),
      ...(area?.objects ?? []).flatMap((object, index) =>
        object.collision === "solid" ? [rectAt(object, zone.objects[index] ?? object.origin)] : [],
      ),
    ];
    const ceiling = solids.filter(
      (rect) =>
        Math.abs(body.y - rect.y - rect.height) <= EDGE &&
        body.x < rect.x + rect.width &&
        body.x + body.width > rect.x,
    );
    const wall = solids.filter(
      (rect) =>
        (Math.abs(body.x + body.width - rect.x) <= EDGE ||
          Math.abs(body.x - rect.x - rect.width) <= EDGE) &&
        body.y < rect.y + rect.height &&
        body.y + body.height > rect.y,
    );
    return {
      area: zone.area,
      bird,
      body,
      ceiling,
      death: zone.death,
      support: requiredRouteObservation(tuning, layout, surfaces, zone)?.support,
      wall,
    };
  };
  const controller: QualificationController<typeof GROUNDED_GAP_CONTROLLER> = {
    id: GROUNDED_GAP_CONTROLLER,
    input(current, target, move) {
      const { bird, support } = current;
      const unavailable = () => ({
        unavailable: {
          index: target?.index ?? active?.target.index ?? -1,
          reason: "missed-support" as const,
        },
      });
      if (failure !== undefined) {
        return unavailable();
      }
      if (!active) {
        if (
          !target ||
          !bird.grounded ||
          !support ||
          target.surface.key === support.key ||
          target.surface.left <= support.right + EDGE ||
          target.surface.y > support.y
        ) {
          return undefined;
        }
        active = { from: support, phase: "approach", target };
        released = false;
        fell = false;
      }
      if (
        tuning.doubleJump ||
        tuning.dash !== undefined ||
        !target ||
        target.index !== active.target.index ||
        current.area !== active.from.area ||
        active.from.mover !== undefined ||
        target.surface.mover !== undefined ||
        bird.carryVx !== 0 ||
        (bird.dash?.remainingSeconds ?? 0) !== 0 ||
        ![bird.x, bird.y, bird.vx, bird.vy].every(Number.isFinite) ||
        bird.vx > tuning.walkSpeed ||
        bird.vx < 0
      ) {
        failure = "unsupported";
        return unavailable();
      }
      if (active.phase === "approach") {
        if (
          !bird.grounded ||
          bird.bufferLeft !== 0 ||
          support?.key !== active.from.key ||
          bird.vy !== 0 ||
          !standsOn(tuning, bird, {
            height: 1,
            width: active.from.right - active.from.left,
            x: active.from.left,
            y: active.from.y,
          })
        ) {
          failure = "unsupported";
          return unavailable();
        }
        const vx = ordinaryHorizontalVelocity(tuning, STEP_SECONDS, 1, true, bird.vx);
        const press = !bird.jumpHeld && bird.x + vx * STEP_SECONDS >= active.from.right - EDGE;
        if (press) {
          active.phase = "press";
        }
        return { input: { jumpHeld: press, move: 1, useHeld: false } };
      }
      return {
        input: { jumpHeld: active.phase === "ascent" && bird.vy < 0, move, useHeld: false },
      };
    },
    observe(tick, input, before, after) {
      const emit = (kind: GapEvent["kind"]) =>
        events.push({
          after: frame(after),
          before: frame(before),
          input: { ...input },
          kind,
          tick,
        });
      if (after.death !== undefined) {
        emit("death");
      }
      if (!active) {
        return;
      }
      const rising = after.bird.vy < 0 && after.bird.y < before.bird.y && !after.bird.grounded;
      if (active.phase === "press") {
        emit("takeoff");
        if (
          !rising ||
          frame(after).ceiling.length > 0 ||
          (frame(after).wall.length > 0 && before.bird.vx > 0 && after.bird.vx === 0)
        ) {
          emit("interrupted");
          failure = "interrupted";
        } else {
          active.phase = "ascent";
        }
      } else if (
        active.phase === "ascent" &&
        (!rising || (frame(after).wall.length > 0 && before.bird.vx > 0 && after.bird.vx === 0))
      ) {
        if (
          after.bird.grounded ||
          frame(after).ceiling.length > 0 ||
          (frame(after).wall.length > 0 && before.bird.vx > 0 && after.bird.vx === 0) ||
          (after.bird.y > before.bird.y && before.bird.vy < 0 && after.bird.vy === 0)
        ) {
          emit("interrupted");
          failure = "interrupted";
        } else {
          emit("apex");
          active.phase = "fall";
        }
      }
      if (active.phase !== "approach" && before.bird.jumpHeld && !input.jumpHeld && !released) {
        emit("release");
        released = true;
      }
      if (active.phase !== "approach" && after.bird.vy > 0 && !fell) {
        emit("first-fall");
        fell = true;
      }
      if (active.phase === "fall" && after.bird.grounded) {
        emit("landing");
        active = undefined;
      }
    },
  };
  return { controller, events, failure: () => failure };
}
