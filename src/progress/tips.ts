import type { SkillId, TipId } from "../data/types/index.ts";
import { isSkillId } from "./skills.ts";

// Every first-time tip, the keys of TEXT.tips.
export const TIP_IDS: readonly TipId[] = [
  "bosses",
  "controls",
  "doors",
  "hazards",
  "powerUp",
  "secondPowerUp",
];

// The tips play triggers by what it shows, apart from the grants'.
export type PlayTipId = Exclude<TipId, "powerUp">;

// A tip waiting to show; the power-up tip names the newly owned skill its {skill} shows.
export type QueuedTip =
  { readonly id: PlayTipId } | { readonly id: "powerUp"; readonly skill: SkillId };

// A shown tip as progress saves it: its id, or for the power-up tip powerUp:<skill>, so the tip
// shows once for each skill.
export type SeenTip = PlayTipId | `powerUp:${SkillId}`;

export function seenTip(tip: QueuedTip): SeenTip {
  return tip.id === "powerUp" ? `powerUp:${tip.skill}` : tip.id;
}

export function isSeenTip(value: unknown): value is SeenTip {
  if (typeof value !== "string") {
    return false;
  }
  const [id, skill, ...rest] = value.split(":");
  return id === "powerUp"
    ? rest.length === 0 && isSkillId(skill)
    : skill === undefined && TIP_IDS.includes(id as TipId);
}
