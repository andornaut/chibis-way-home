import type { SkillId, TipId } from "../data/types/index.ts";

// Every first-time tip, the keys of TEXT.tips.
export const TIP_IDS: readonly TipId[] = [
  "bosses",
  "controls",
  "doors",
  "firstPowerUp",
  "hazards",
  "secondPowerUp",
];

export function isTipId(value: unknown): value is TipId {
  return TIP_IDS.includes(value as TipId);
}

// A tip waiting to show: its id, and for the first power-up the granted skill its {skill} names.
export interface QueuedTip {
  readonly id: TipId;
  readonly skill?: SkillId;
}
