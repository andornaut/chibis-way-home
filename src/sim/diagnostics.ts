import { createHash } from "node:crypto";

import { SCREEN } from "../data/screen";
import type {
  BehaviourMotion,
  BirdTuning,
  Motion,
  Rect,
  ZoneDeath,
  ZoneLayout,
} from "../data/types";
import { contactBox } from "../rules/behaviour";
import { birdBox } from "../rules/bird";
import { overlaps } from "../rules/rect";
import { STEP_SECONDS } from "../rules/step";
import type { ZoneInput, ZoneState } from "../rules/zone";
import type { NavigationDiagnostic } from "./bot";
import type { SimulationConfig, SimulationProvenance, SimulationSeeds } from "./simulate";

export const VALIDATION_LIMITS = {
  batchWallTimeMs: 600000,
  maxRetries: 3,
  maxSteps: Math.floor(750 / STEP_SECONDS),
  maxWallTimeMs: 30000,
  stopAfterStallTicks: 1200,
} as const;

export interface TraceOptions {
  readonly maxEvents: number;
  readonly sampleEveryTicks?: number;
  readonly stallTicks: number;
}
interface NearbyTerrain {
  readonly distance: number;
  readonly index: number;
  readonly rect: Rect;
}
interface NearbyObject extends NearbyTerrain {
  readonly active: boolean | undefined;
  readonly areaSeconds: number;
  readonly behaviourMotion: BehaviourMotion | undefined;
  readonly character: string;
  readonly collision: string;
  readonly facing: -1 | 1 | undefined;
  readonly motion: Motion;
  readonly phase: number;
  readonly stateKey: string | undefined;
  readonly stateSeconds: number | undefined;
}

export interface TraceEvent {
  readonly nearby: {
    readonly terrain: readonly NearbyTerrain[];
    readonly objects: readonly NearbyObject[];
  };
  readonly planner?: NavigationDiagnostic;
  readonly area: string;
  readonly attempt: number;
  readonly attemptTick: number;
  readonly chunk: number | undefined;
  readonly chunkId: string | undefined;
  readonly deathReason: ZoneDeath["reason"] | undefined;
  readonly input: ZoneInput;
  readonly kind: "death" | "sample" | "stall" | "terminal";
  // An overlapping or nearest object is a diagnostic candidate, not proof of causation.
  readonly object:
    | {
        readonly character: string;
        readonly distance: number;
        readonly facing: -1 | 1 | undefined;
        readonly index: number;
        readonly overlapsBird: boolean;
        readonly stateKey: string | undefined;
        readonly x: number;
        readonly y: number;
      }
    | undefined;
  readonly tick: number;
  readonly x: number;
  readonly y: number;
}

export function traceEvent(
  tuning: BirdTuning,
  layout: ZoneLayout,
  kind: TraceEvent["kind"],
  tick: number,
  attemptTick: number,
  input: ZoneInput,
  chunkIds: Readonly<Record<string, readonly string[]>> | undefined,
  planner: NavigationDiagnostic | undefined,
  zone: ZoneState,
): TraceEvent {
  const area = layout.areas[zone.area];
  if (!area) {
    throw new Error(`No area ${zone.area}`);
  }
  const box = birdBox(tuning, zone.bird);
  let closest: TraceEvent["object"];
  const terrain: NearbyTerrain[] = [];
  const objects: NearbyObject[] = [];
  const distanceTo = (rect: Rect) =>
    Math.hypot(
      Math.max(0, rect.x - box.x - box.width, box.x - rect.x - rect.width),
      Math.max(0, rect.y - box.y - box.height, box.y - rect.y - rect.height),
    );
  const retain = <Value extends NearbyTerrain>(values: Value[], value: Value) => {
    if (value.distance > SCREEN.width / 2) {
      return;
    }
    values.push(value);
    values.sort((a, b) => a.distance - b.distance || a.index - b.index);
    if (values.length > 4) {
      values.pop();
    }
  };
  area.solids.forEach((rect, index) =>
    retain(terrain, { distance: distanceTo(rect), index, rect: { ...rect } }),
  );
  for (let index = 0; index < area.objects.length; index++) {
    const object = area.objects[index];
    if (!object || object.collision === "none") {
      continue;
    }
    const at = zone.objects[index] ?? object.origin;
    const behaviour = zone.behaviours[index];
    const rect =
      object.collision === "hazard"
        ? contactBox(object, at, behaviour?.facing ?? 1, behaviour?.axis)
        : { ...at, height: object.height, width: object.width };
    const distance = distanceTo(rect);
    if (object.collision !== "use") {
      retain(objects, {
        active: behaviour?.active,
        areaSeconds: zone.seconds,
        behaviourMotion: behaviour
          ? object.behaviour?.states[behaviour.stateKey]?.motion
          : undefined,
        character: object.character,
        collision: object.collision,
        distance,
        facing: behaviour?.facing,
        index,
        motion: { ...object.motion },
        phase: object.phase,
        rect: { ...rect },
        stateKey: behaviour?.stateKey,
        stateSeconds: behaviour?.elapsed,
      });
    }
    const touching = overlaps(box, rect);
    if (
      closest === undefined ||
      (touching && !closest.overlapsBird) ||
      (touching === closest.overlapsBird && distance < closest.distance)
    ) {
      closest = {
        character: object.character,
        distance,
        facing: behaviour?.facing,
        index,
        overlapsBird: touching,
        stateKey: behaviour?.stateKey,
        x: at.x,
        y: at.y,
      };
    }
  }
  const chunk = area.chunks.findIndex(
    ({ width, x }) => box.x + box.width / 2 >= x && box.x + box.width / 2 < x + width,
  );
  return {
    area: zone.area,
    attempt: zone.attempt,
    attemptTick,
    chunk: chunk < 0 ? undefined : chunk,
    chunkId: chunk < 0 ? undefined : chunkIds?.[zone.area]?.[chunk],
    deathReason: zone.death?.reason,
    input,
    kind,
    nearby: { objects, terrain },
    ...(planner
      ? {
          planner: {
            ...planner,
            candidates: planner.candidates.slice(0, 8).map((candidate) => ({
              ...candidate,
              predictedEndpoint: { ...candidate.predictedEndpoint },
            })),
            origin: { ...planner.origin },
            previousPlan: planner.previousPlan ? { ...planner.previousPlan } : null,
            waypoint: planner.waypoint ? { ...planner.waypoint } : null,
          },
        }
      : {}),
    object: closest,
    tick,
    x: zone.bird.x,
    y: zone.bird.y,
  };
}

export interface WitnessSegment {
  readonly attempt: number;
  readonly input: ZoneInput;
  readonly ticks: number;
}
export interface CompletionWitness {
  readonly capturedTicks: number;
  readonly config: SimulationConfig;
  readonly contextHash: string;
  readonly finalArea: string;
  readonly provenance: SimulationProvenance;
  readonly retries: number;
  readonly seeds: SimulationSeeds;
  readonly segments: readonly WitnessSegment[];
  readonly steps: number;
  readonly truncated: boolean;
}

export function witnessContextHash(tuning: BirdTuning, layout: ZoneLayout): string {
  return createHash("sha256").update(JSON.stringify({ layout, tuning })).digest("hex");
}
