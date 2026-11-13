import {
  HIT_RULE,
  hitAround as sharedHitAround,
  hitMargin as sharedHitMargin,
} from "@andornaut/game-kit/ui/hitAreas";

import type { Rect } from "../../data/types/index.ts";

export { type PressArea, pressedArea, type PressShape } from "@andornaut/game-kit/ui/hitAreas";

// Bind the shared press-area geometry to the existing rule while keeping local callers unchanged.
export function hitMargin(art: Rect): number {
  return sharedHitMargin(HIT_RULE, art);
}

export function hitAround(art: Rect): Rect {
  return sharedHitAround(HIT_RULE, art);
}
