import { type Random, randomStream } from "@andornaut/game-kit/runtime/random";

import { namedStreams, type RandomStreams } from "../../ai/index.ts";

// What an attempt's object draws: its motion track, its behaviour's decisions and its art quirk.
export type ZoneStreamPurpose = "idle-roam" | "motion" | "quirk";

// The zone values a per-attempt stream derives from. Retry keeps the seed and advances the attempt.
export interface ZoneDraws {
  readonly attempt: number;
  readonly seed: number;
}

// Each attempt's object streams derive from the zone seed under a name holding the purpose, area,
// attempt and object index, so no two seed and attempt pairs share a stream and a draw added under
// one name never shifts another.
export function zoneStreamName(
  zone: ZoneDraws,
  purpose: ZoneStreamPurpose,
  area: string,
  index: number,
): string {
  return `${purpose}:${area}:${zone.attempt}:${index}`;
}

export function zoneStream(
  zone: ZoneDraws,
  purpose: ZoneStreamPurpose,
  area: string,
  index: number,
): Random {
  return randomStream(zone.seed, zoneStreamName(zone, purpose, area, index));
}

// An object's decision streams, one per decision key under its per-attempt name.
export function zoneDecisionStreams(zone: ZoneDraws, area: string, index: number): RandomStreams {
  return namedStreams(zone.seed, zoneStreamName(zone, "idle-roam", area, index));
}
