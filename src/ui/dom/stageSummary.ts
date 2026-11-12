import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { CARD_CONTENT, STAGE_PREVIEW, STAGE_SUMMARY } from "../../data/layout.ts";
import type { DialogueSpeaker } from "../../data/types/index.ts";
import { CUTSCENE_CONTINUE } from "../layout/cutscene.ts";
import { capTop, FONT_METRICS, UI_FONT_FACE } from "../layout/fontRoles.ts";
import type { StatsMetricRow } from "../layout/runStats.ts";
import { textButton } from "./card.ts";
import { createRunStats } from "./runStats.ts";

// The full-page stage summary in the HTML UI (stageSummary.css, after runStats.css): over a black
// view, the zone's name, the stage and progress lines, the cleared stage's preview, the stage's
// metrics beside the totals, the antagonist's clear statement where there is one, and Continue
// at the bottom-right. The cutscene between stages and the departure from a zone show it.

const { body } = FONT_METRICS;
// How far a metric's cap height starts below its line box, and its baseline sits above the box's
// bottom: the statistics' line boxes are CARD_CONTENT.lineHeight tall.
const STAT_CAP_TOP = capTop({ lineHeight: CARD_CONTENT.lineHeight, size: body.size });
const STAT_BELOW_BASELINE =
  CARD_CONTENT.lineHeight - STAT_CAP_TOP - UI_FONT_FACE.capHeight * body.size;
const continueAt = CUTSCENE_CONTINUE;

// The layout properties stageSummary.css reads, in base px, written on the summary's view.
export const STAGE_SUMMARY_LAYOUT: LayoutValues = {
  "--summary-continue-hit": continueAt.button.x - continueAt.hit.x,
  "--summary-continue-width": continueAt.button.width,
  "--summary-continue-x": continueAt.hit.x,
  "--summary-continue-y": continueAt.hit.y,
  "--summary-heading-line": FONT_METRICS.compactMainHeading.lineHeight,
  "--summary-heading-size": FONT_METRICS.compactMainHeading.size,
  "--summary-padding": CARD_CONTENT.padding,
  "--summary-preview-height": STAGE_SUMMARY.previewHeight,
  "--summary-preview-width":
    (STAGE_SUMMARY.previewHeight * STAGE_PREVIEW.width) / STAGE_PREVIEW.height,
  "--summary-row-gap": CARD_CONTENT.rowGap,
  // The gap from the last metric's baseline to the statement's ink, and from the preview to the
  // first metric's ink.
  "--summary-statement-gap": CARD_CONTENT.gap - STAT_BELOW_BASELINE,
  "--summary-stats-gap": CARD_CONTENT.rowGap - STAT_CAP_TOP,
  "--summary-stats-width": 2 * STAGE_SUMMARY.columnWidth + 2 * CARD_CONTENT.padding,
  "--summary-word-gap": CARD_CONTENT.gap,
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
  zone.id = `${id}-zone`;
  const preview = element("img", "stage-summary-preview");
  preview.alt = "";
  const stats = createRunStats(document, { columnGap: 2 * CARD_CONTENT.padding }, [
    words.stats,
    words.totals,
  ]);
  dialog.append(
    zone,
    text("p", "stage-summary-stage", words.stage),
    text("p", "stage-summary-progress", words.progress),
    preview,
    stats,
  );
  const statement =
    words.statement === undefined
      ? undefined
      : (() => {
          const line = element("p", "stage-summary-statement");
          line.dataset.continue = "";
          const name = text("span", "stage-summary-speaker", `${words.statement.name}:`);
          name.dataset.colour = words.statement.colour;
          line.append(name, text("span", "stage-summary-said", words.statement.text));
          return line;
        })();
  if (statement !== undefined) {
    dialog.append(statement);
  }
  const footer = element("div", "stage-summary-footer");
  const button = textButton(document, words.continue, true);
  button.dataset.continue = "";
  footer.append(button);
  dialog.append(footer);
  view.append(dialog);
  root.append(view);
  return { continue: button, dialog, preview, root, ...(statement && { statement }) };
}
