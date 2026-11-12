import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import { expect, it } from "vitest";

import { CARD_CONTENT } from "../../data/layout.ts";
import { ZONE_MAP } from "../../data/map.ts";
import { SCREEN } from "../../data/screen.ts";
import { TEXT } from "../../data/text.ts";
import { deathLabels, deathSummary } from "../../presentation/index.ts";
import { CARD_FONTS } from "../../testing/cardFonts.ts";
import { statsStatement } from "../dialogue/statsStatement.ts";
import { capTop, FONT_METRICS, FONT_NATIVE_SIZE, UI_FONT_FACE } from "../layout/fontRoles.ts";
import { stageSummaryGaps } from "./stageSummary.ts";

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

// Each row's box trims to its cap height and baseline, so its margin adds the ink the previous row
// drops below its baseline and the ink this row lifts above its cap height to the rule's gap.
it("leaves the rule's gaps between the rows' measured ink", () => {
  const inks: Readonly<Record<string, { fall: number; rise: number }>> = {
    "Attempts:": { fall: 3, rise: 0 },
    "Last time:": { fall: 0, rise: 1 },
    Progress: { fall: 3, rise: 0.5 },
    Stage: { fall: 3.5, rise: 0.75 },
    Zone: { fall: 3.25, rise: 0 },
  };
  const row = (label: string) => ({ label, value: "1" });
  const gaps = stageSummaryGaps((_role, text) => inks[text] ?? { fall: 0, rise: 0 }, {
    continue: "Continue",
    progress: "Progress",
    stage: "Stage",
    statement: { colour: "tan", name: "Kiwi", text: "Words" },
    stats: [row("Last time:"), row("Attempts:")],
    totals: [row("Stage total:"), row("Run total:")],
    zone: "Zone",
  });
  const { body } = FONT_METRICS;
  const capTop16 = capTop({ lineHeight: CARD_CONTENT.lineHeight, size: body.size });
  const belowBaseline = CARD_CONTENT.lineHeight - capTop16 - UI_FONT_FACE.capHeight * body.size;
  expect(gaps).toEqual({
    "--summary-preview-gap": CARD_CONTENT.rowGap + 3,
    "--summary-progress-gap": CARD_CONTENT.rowGap + 3.5 + 0.5,
    "--summary-stage-gap": CARD_CONTENT.rowGap + 3.25 + 0.75,
    "--summary-statement-gap": CARD_CONTENT.gap - belowBaseline + 3,
    "--summary-stats-gap": CARD_CONTENT.rowGap - capTop16 + 1,
  });
});
