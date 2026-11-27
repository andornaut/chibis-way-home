import { randomStream, shuffled } from "@andornaut/game-kit/runtime/random";

import type { MapDestination, RoomPlan, SkillId, ZoneMap } from "../data/types/index.ts";
import { SKILL_IDS } from "./skills.ts";

export interface GiftVisit {
  readonly seed: number;
  readonly zone: string;
}

export interface PreparedStageGift {
  readonly giftRoom: string | null;
  readonly previousVisit: GiftVisit | null;
  readonly stage: string;
  readonly visit: GiftVisit;
}

export function sameGiftVisit(a: GiftVisit | null, b: GiftVisit | null): boolean {
  return a === b || (a !== null && b !== null && a.zone === b.zone && a.seed === b.seed);
}

export function isGiftVisit(map: ZoneMap, value: unknown): value is GiftVisit {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const visit = value as Partial<GiftVisit>;
  return (
    Number.isSafeInteger(visit.seed) &&
    visit.seed! >= 0 &&
    visit.seed! <= 0xffffffff &&
    map.destinations.some(({ id }) => id === visit.zone)
  );
}

// Stage and skill draws have independent streams, separate from assembly and physics.
export function giftDraw(destination: MapDestination, seed: number): ReadonlyMap<string, SkillId> {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("Invalid gift visit seed");
  }
  const { giftCount, id, stages } = destination;
  if (giftCount > stages.length || giftCount > SKILL_IDS.length) {
    throw new RangeError(`Too many gifts for destination ${id}`);
  }
  const drawnStages = shuffled(randomStream(seed, `gifts:${id}:stages`), stages);
  const skills = shuffled(randomStream(seed, `gifts:${id}:skills`), SKILL_IDS);
  return new Map(drawnStages.slice(0, giftCount).map((stage, index) => [stage, skills[index]!]));
}

export function prepareGift(
  map: ZoneMap,
  rooms: Readonly<Record<string, RoomPlan>>,
  current: GiftVisit | null,
  stage: string,
  proposedSeed: number,
): PreparedStageGift | undefined {
  const destination = map.destinations.find(({ stages }) => stages.includes(stage));
  if (destination === undefined) {
    return undefined;
  }
  const visit =
    current?.zone === destination.id ? current : { seed: proposedSeed, zone: destination.id };
  const skill = giftDraw(destination, visit.seed).get(stage);
  const matches =
    skill === undefined ? [] : Object.entries(rooms).filter(([, room]) => room.grant === skill);
  if (skill !== undefined && matches.length !== 1) {
    throw new Error(`A gift needs one room for skill ${skill}`);
  }
  return { giftRoom: matches[0]?.[0] ?? null, previousVisit: current, stage, visit };
}
