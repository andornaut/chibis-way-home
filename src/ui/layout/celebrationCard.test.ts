import { HIT_RULE } from "@andornaut/game-kit/runtime/ui/hitAreas";
import { expect, it } from "vitest";

import { TEXT_BUTTON } from "../../data/layout.ts";
import { CELEBRATION } from "./celebrationCard.ts";
import { hitMargin } from "./hitAreas.ts";

it("fits a standard action and its full press outset inside the celebration card", () => {
  const { actionsY, card } = CELEBRATION;
  const margin = hitMargin({
    height: TEXT_BUTTON.height,
    width: TEXT_BUTTON.height,
    x: 0,
    y: actionsY,
  });
  expect(actionsY).toBe(208);
  expect(actionsY - margin).toBeGreaterThan(card.y);
  expect(actionsY + TEXT_BUTTON.height + margin).toBeLessThanOrEqual(card.y + card.height);
  expect(TEXT_BUTTON.height + 2 * margin).toBeGreaterThanOrEqual(HIT_RULE.minTarget);
});
