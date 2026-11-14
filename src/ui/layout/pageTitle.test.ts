import { expect, it } from "vitest";

import { CARD_CONTENT } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { MAP_SCREEN } from "./mapScreen.ts";
import { PAGE_TITLE } from "./pageTitle.ts";
import { PAUSE_BUTTON } from "./pauseCard.ts";

it("centres page titles with equal side clearances beyond the shared menu press target", () => {
  const left = PAGE_TITLE.x - PAGE_TITLE.width / 2;
  const right = PAGE_TITLE.x + PAGE_TITLE.width / 2;
  expect(left).toBeGreaterThanOrEqual(
    PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width + CARD_CONTENT.gap,
  );
  expect(SCREEN.width - right).toBe(left);
  expect(MAP_SCREEN.title).toEqual(PAGE_TITLE);
});
