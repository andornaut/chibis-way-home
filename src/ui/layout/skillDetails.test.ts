import { describe, expect, it } from "vitest";

import { CARD_CONTENT, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { SKILL_ROOM } from "./skillDetails.ts";

describe("native skill presentation", () => {
  it("keeps the gift footer's face anchor and its panel clear of the press area", () => {
    const footer = SKILL_ROOM.footer;
    expect(footer.height).toBe(TEXT_BUTTON.height);
    expect(SCREEN.width - footer.x - footer.width).toBe(CARD_CONTENT.padding);
    expect(SCREEN.height - footer.y - footer.height).toBe(CARD_CONTENT.padding);
    expect(SKILL_ROOM.bounds.y + SKILL_ROOM.bounds.height).toBeLessThan(footer.y);
  });
});
