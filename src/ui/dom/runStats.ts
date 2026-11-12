import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import { slice } from "@andornaut/game-kit/web/ui/dom/viewUnits";

import { CARD_CONTENT } from "../../data/layout.ts";
import type { StatsMetricRow } from "../layout/runStats.ts";

// Run statistics in the HTML UI (runStats.css): side-by-side columns of equal width, each a
// description list of metric rows with the label at its left and the value at its right, and an
// optional ink divider between the columns. The death card shows them, and the cutscene and
// departure statistics share them.

export interface RunStatsLayout {
  // The gap between each column and the divider, or between the columns without one, in base px.
  readonly columnGap: number;
  // The divider's width in base px, kept whole in CSS px; none where undefined.
  readonly divider?: number;
}

// The layout properties runStats.css reads, written on the statistics' element.
export function runStatsProperties(layout: RunStatsLayout): LayoutValues {
  return {
    "--run-stats-column-gap": layout.columnGap,
    "--run-stats-label-gap": CARD_CONTENT.gap,
    "--run-stats-line": CARD_CONTENT.lineHeight,
    "--run-stats-row-gap": CARD_CONTENT.rowGap,
    ...(layout.divider !== undefined && { "--run-stats-divider": slice(layout.divider) }),
  };
}

// The statistics for columns, each column's rows in reading order.
export function createRunStats(
  document: Document,
  layout: RunStatsLayout,
  columns: readonly (readonly StatsMetricRow[])[],
): HTMLElement {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const stats = element("div", "ui-run-stats");
  writeLayoutProperties(runStatsProperties(layout), stats);
  const lists = columns.map((rows) => {
    const list = element("dl", "ui-run-stats-column");
    list.append(
      ...rows.map(({ label, value }) => {
        const row = element("div", "ui-run-stats-row");
        const term = element("dt", "ui-run-stats-label");
        term.textContent = label;
        const detail = element("dd", "ui-run-stats-value");
        detail.textContent = value;
        row.append(term, detail);
        return row;
      }),
    );
    return list;
  });
  if (layout.divider === undefined) {
    stats.append(...lists);
  } else {
    stats.dataset.divider = "";
    stats.append(
      ...lists.flatMap((list, index) => {
        if (index === 0) {
          return [list];
        }
        const divider = element("div", "ui-run-stats-divider");
        divider.setAttribute("aria-hidden", "true");
        return [divider, list];
      }),
    );
  }
  return stats;
}
