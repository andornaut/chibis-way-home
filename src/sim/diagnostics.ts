import { createHash } from "node:crypto";

import type { BirdTuning, ZoneDeath, ZoneLayout } from "../data/types";
import { contactBox } from "../rules/behaviour";
import { birdBox } from "../rules/bird";
import { overlaps } from "../rules/rect";
import type { ZoneInput, ZoneState } from "../rules/zone";
import type { SimulationConfig, SimulationProvenance, SimulationSeeds } from "./simulate";

export interface TraceOptions {
  readonly maxEvents: number;
  readonly sampleEveryTicks?: number;
  readonly stallTicks: number;
}
export interface TraceEvent {
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
  zone: ZoneState,
  chunkIds?: Readonly<Record<string, readonly string[]>>,
): TraceEvent {
  const area = layout.areas[zone.area];
  if (!area) {
    throw new Error(`No area ${zone.area}`);
  }
  const box = birdBox(tuning, zone.bird);
  let closest: TraceEvent["object"];
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
    const distance = Math.hypot(
      Math.max(0, rect.x - box.x - box.width, box.x - rect.x - rect.width),
      Math.max(0, rect.y - box.y - box.height, box.y - rect.y - rect.height),
    );
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
