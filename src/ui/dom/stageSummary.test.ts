import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import { expect, it } from "vitest";

import { CARD_CONTENT } from "../../data/layout.ts";
import { ZONE_MAP } from "../../data/map.ts";
import { SCREEN } from "../../data/screen.ts";
import { TEXT } from "../../data/text.ts";
import { deathLabels, deathSummary } from "../../presentation/index.ts";
import { CARD_FONTS } from "../../testing/cardFonts.ts";
import { statsStatement } from "../dialogue/statsStatement.ts";
import { FONT_METRICS, FONT_NATIVE_SIZE } from "../layout/fontRoles.ts";

// The summary's rows are single lines centred across the page between its padding, at their
// roles' sizes: every zone name, stage line and clear statement fits, so none wraps toward
// Continue, measured with the bitmap fonts, which repaint the UI's Liberation Sans faces.
it("fits every stage's zone name, stage line and clear statement on one line", () => {
  const room = SCREEN.width - 2 * CARD_CONTENT.padding;
  const heading = FONT_METRICS.compactMainHeading.size / FONT_NATIVE_SIZE;
  const unfit = ZONE_MAP.destinations.flatMap(({ stages }) =>
    stages.flatMap((stage) => {
      const words = deathSummary(TEXT.death, {
        ...deathLabels(ZONE_MAP, TEXT.map, stage, stage),
        activeSeconds: 0,
        percent: 1,
      });
      const statement = statsStatement("clear", stage)!;
      const widths = [
        inkWidth(CARD_FONTS.title, heading, words.title),
        inkWidth(CARD_FONTS.body, 1, words.stage),
        inkWidth(CARD_FONTS.body, 1, `${statement.name}:`) +
          CARD_CONTENT.gap +
          inkWidth(CARD_FONTS.body, 1, statement.text),
      ];
      return widths.some((width) => width > room) ? [stage] : [];
    }),
  );
  expect(unfit).toEqual([]);
});
