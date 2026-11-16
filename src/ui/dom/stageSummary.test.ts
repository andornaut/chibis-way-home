// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { CARD_CONTENT } from "../../data/layout.ts";
import { capTop, FONT_METRICS, UI_FONT_FACE } from "../layout/fontRoles.ts";
import { createStageSummary, stageSummaryGaps } from "./stageSummary.ts";

it("opts the fixed-width summary statistics into canonical columns without changing reading order", () => {
  const view = createStageSummary(document, "summary", {
    continue: "Continue",
    progress: "Progress",
    stage: "Stage",
    stats: [
      { label: "Last time:", value: "1:05" },
      { label: "Best time:", value: "0:56" },
      { label: "Attempts:", value: "2" },
    ],
    totals: [
      { label: "Stage total:", value: "2:01" },
      { label: "Zone total:", value: "5:10" },
      { label: "Run total:", value: "10:10" },
    ],
    zone: "Zone",
  });
  const stats = view.dialog.querySelector<HTMLElement>(":scope > .ui-run-stats")!;
  expect(stats.dataset.uiLayoutSizing).toBe("equal");
  expect(stats.style.getPropertyValue("--ui-layout-gap")).toBe(String(2 * CARD_CONTENT.padding));
  const divider = stats.querySelector(":scope > .ui-run-stats-divider")!;
  expect(divider.classList.contains("ui-page-divider")).toBe(true);
  expect(divider.getAttribute("aria-hidden")).toBe("true");
  expect(stats.querySelectorAll(":scope > dl")).toHaveLength(2);
  expect([...stats.querySelectorAll("dt, dd")].map((node) => node.textContent)).toEqual([
    "Last time:",
    "1:05",
    "Best time:",
    "0:56",
    "Attempts:",
    "2",
    "Stage total:",
    "2:01",
    "Zone total:",
    "5:10",
    "Run total:",
    "10:10",
  ]);
  expect(view.dialog.getAttribute("aria-labelledby")).toBe("summary-zone");
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
