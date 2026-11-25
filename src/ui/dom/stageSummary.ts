import { createPageDivider } from "@andornaut/game-kit/runtime/web/ui/dom/controlPresentation";
import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";
import { setTextRole } from "@andornaut/game-kit/runtime/web/ui/dom/uiTheme";
import { slice } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";

import { CARD_CONTENT, DEATH_CARD, STAGE_PREVIEW, STAGE_SUMMARY } from "../../data/layout.ts";
import type { DialogueSpeaker } from "../../data/types/index.ts";
import { capTop, FONT_METRICS, UI_FONT_FACE } from "../layout/fontRoles.ts";
import type { StatsMetricRow } from "../layout/runStats.ts";
import { createActions } from "./actions.ts";
import { textButton } from "./card.ts";
import { createRunStats } from "./runStats.ts";

// The full-page stage summary in the HTML UI (stageSummary.css, after runStats.css): over a black
// view, the zone's name, the stage and progress lines, the cleared stage's preview, the stage's
// metrics beside the totals, the antagonist's clear statement where there is one, and Continue
// centred in the footer, a sole action in its kit action group. The cutscene between stages and
// the departure from a zone show it.

const { body, compactMainHeading } = FONT_METRICS;
// How far a metric's cap height starts below its line box, and its baseline sits above the box's
// bottom: the statistics' line boxes are CARD_CONTENT.lineHeight tall.
const STAT_CAP_TOP = capTop({ lineHeight: CARD_CONTENT.lineHeight, size: body.size });
const STAT_BELOW_BASELINE =
  CARD_CONTENT.lineHeight - STAT_CAP_TOP - UI_FONT_FACE.capHeight * body.size;
// How far body text's ascenders rise above its cap height.
const ASCENDER_RISE = (STAGE_SUMMARY.ascender - UI_FONT_FACE.capHeight) * body.size;

// The layout properties stageSummary.css reads, in base px, written on the summary's view. The
// rows' gaps are the stylesheet's: each text row's box runs from its cap height to the font's
// descent, the row gap apart, and these offsets from the font's metrics place the ink of the
// rows whose boxes differ.
export const STAGE_SUMMARY_LAYOUT: LayoutValues = {
  "--run-stats-divider": slice(DEATH_CARD.dividerWidth),
  // The ink a row with ascenders lifts above its cap height.
  "--summary-ascender": ASCENDER_RISE,
  // The room a body line's descenders take below its baseline.
  "--summary-descent": UI_FONT_FACE.descent * body.size,
  "--summary-padding": CARD_CONTENT.padding,
  "--summary-preview-height": STAGE_SUMMARY.previewHeight,
  "--summary-preview-width":
    (STAGE_SUMMARY.previewHeight * STAGE_PREVIEW.width) / STAGE_PREVIEW.height,
  "--summary-row-gap": CARD_CONTENT.rowGap,
  // The room a metric's line box holds above its cap height.
  "--summary-stat-cap-top": STAT_CAP_TOP,
  // How far a metric's descenders fall below its line box.
  "--summary-stat-descent": UI_FONT_FACE.descent * body.size - STAT_BELOW_BASELINE,
  "--summary-stats-width": 2 * STAGE_SUMMARY.columnWidth + 2 * CARD_CONTENT.padding,
  "--summary-word-gap": CARD_CONTENT.gap,
  "--summary-zone-descent": UI_FONT_FACE.descent * compactMainHeading.size,
};

export interface StageSummaryWords {
  readonly continue: string;
  readonly progress: string;
  readonly stage: string;
  // The current stage's metrics, in the column's order.
  readonly stats: readonly StatsMetricRow[];
  // The antagonist's clear statement: their name in their colour, then what they say.
  readonly statement?: {
    readonly colour: DialogueSpeaker["colour"];
    readonly name: string;
    readonly text: string;
  };
  readonly totals: readonly StatsMetricRow[];
  readonly zone: string;
}

export interface StageSummaryView {
  readonly continue: HTMLButtonElement;
  // The summary: role dialog, named by the zone's name.
  readonly dialog: HTMLElement;
  // The preview, whose source the caller sets.
  readonly preview: HTMLImageElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
  readonly statement?: HTMLElement;
}

// The summary for words, its dialog identified by id, which its parts' ids extend. Continue and
// the statement line are marked data-continue: a tap on either continues.
export function createStageSummary(
  document: Document,
  id: string,
  words: StageSummaryWords,
): StageSummaryView {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const text = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    value: string,
  ) => {
    const created = element(tag, className);
    created.textContent = value;
    return created;
  };
  const root = element("div", "stage-summary-scene");
  const view = element("div", "ui-view stage-summary-view");
  writeLayoutProperties(STAGE_SUMMARY_LAYOUT, view);
  const dialog = element("section", "stage-summary");
  dialog.id = id;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", `${id}-zone`);
  const zone = text("h2", "stage-summary-zone", words.zone);
  setTextRole("summaryZone", zone);
  zone.id = `${id}-zone`;
  const preview = element("img", "stage-summary-preview");
  preview.alt = "";
  const stats = createRunStats(
    document,
    { columnGap: 2 * CARD_CONTENT.padding, sizing: { mode: "equal" } },
    [words.stats, words.totals],
  );
  const divider = createPageDivider(document);
  divider.classList.add("ui-run-stats-divider");
  divider.setAttribute("aria-hidden", "true");
  stats.append(divider);
  dialog.append(
    zone,
    text("p", "stage-summary-stage ui-text-body", words.stage),
    text("p", "stage-summary-progress ui-text-body", words.progress),
    preview,
    stats,
  );
  const statement =
    words.statement === undefined
      ? undefined
      : (() => {
          const line = element("p", "stage-summary-statement ui-text-body");
          line.dataset.continue = "";
          const name = text("span", "stage-summary-speaker", `${words.statement.name}:`);
          name.dataset.colour = words.statement.colour;
          // The space between them is read but not drawn: the gap is the said text's margin.
          line.append(
            name,
            text("span", "stage-summary-space", " "),
            text("span", "stage-summary-said", words.statement.text),
          );
          return line;
        })();
  if (statement !== undefined) {
    dialog.append(statement);
  }
  const footer = element("div", "stage-summary-footer");
  const button = textButton(document, words.continue, true);
  button.dataset.continue = "";
  footer.append(createActions(document, [button]).element);
  dialog.append(footer);
  view.append(dialog);
  root.append(view);
  return { continue: button, dialog, preview, root, ...(statement && { statement }) };
}
