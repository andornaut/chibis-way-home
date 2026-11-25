import type { LayoutColumnSizing, LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";
import { createPageDivider } from "@andornaut/game-kit/runtime/web/ui/dom/controlPresentation";
import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";
import {
  type LayoutComponentPorts,
  mountLayout,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";
import { slice } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";

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
  // Bounded callers opt into canonical column sizing; content-sized cards retain intrinsic sizing.
  readonly sizing?: LayoutColumnSizing;
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

// The parts of the kit's columns node: a column of metric rows, and the divider between two.
type RunStatsSchema = {
  Column: { readonly props: { readonly rows: readonly StatsMetricRow[] }; readonly slots: never };
  Divider: { readonly props: Record<string, never>; readonly slots: never };
};

// A column's description list: each row's label and value.
function column(document: Document, rows: readonly StatsMetricRow[]): HTMLElement {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const list = element("dl", "ui-run-stats-column");
  list.append(
    ...rows.map(({ label, value }) => {
      const row = element("div", "ui-run-stats-row");
      const term = element("dt", "ui-run-stats-label ui-text-body");
      term.textContent = label;
      const detail = element("dd", "ui-run-stats-value ui-text-body");
      detail.textContent = value;
      row.append(term, detail);
      return row;
    }),
  );
  return list;
}

// The kit's ink divider, which a screen reader skips.
function divider(document: Document): HTMLElement {
  const line = createPageDivider(document);
  line.classList.add("ui-run-stats-divider");
  line.setAttribute("aria-hidden", "true");
  return line;
}

function ports(document: Document): LayoutComponentPorts<RunStatsSchema> {
  return {
    Column: {
      create(initial) {
        const element = column(document, initial.rows);
        return {
          dispose() {},
          element,
          slots: {},
          update(props) {
            element.replaceChildren(...column(document, props.rows).children);
          },
        };
      },
      slots: [],
    },
    Divider: {
      create() {
        return { dispose() {}, element: divider(document), slots: {}, update() {} };
      },
      slots: [],
    },
  };
}

// The statistics for columns, each column's rows in reading order.
export function createRunStats(
  document: Document,
  layout: RunStatsLayout,
  columns: readonly (readonly StatsMetricRow[])[],
): HTMLElement {
  let stats: HTMLElement;
  if (layout.sizing === undefined) {
    stats = document.createElement("div");
    stats.className = "ui-run-stats";
    stats.append(
      ...columns.flatMap((rows, index) => [
        ...(layout.divider === undefined || index === 0 ? [] : [divider(document)]),
        column(document, rows),
      ]),
    );
  } else {
    const children: LayoutNode<RunStatsSchema>[] = columns.flatMap((rows, index) => [
      ...(layout.divider === undefined || index === 0
        ? []
        : [
            {
              component: "Divider",
              key: `divider-${index}`,
              kind: "component",
              props: {},
            } as const,
          ]),
      { component: "Column", key: String(index), kind: "component", props: { rows } } as const,
    ]);
    const host = document.createElement("div");
    mountLayout<RunStatsSchema>(
      { components: ports(document), host },
      {
        children,
        gap: layout.columnGap,
        key: "run-stats",
        kind: "columns",
        padding: 0,
        sizing: layout.sizing,
      },
    );
    stats = host.firstElementChild as HTMLElement;
    stats.classList.add("ui-run-stats");
  }
  if (layout.divider !== undefined) {
    stats.dataset.divider = "";
  }
  writeLayoutProperties(runStatsProperties(layout), stats);
  return stats;
}
