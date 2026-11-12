import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { CARD_CONTENT, STAGE_PREVIEW, STAGE_SUMMARY } from "../../data/layout.ts";
import type { DialogueSpeaker } from "../../data/types/index.ts";
import { UI_FONT_FAMILY } from "../chrome/uiFonts.ts";
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

// The layout properties stageSummary.css reads, in base px, written on the summary's view with
// its rows' gaps (stageSummaryGaps).
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
  "--summary-stats-width": 2 * STAGE_SUMMARY.columnWidth + 2 * CARD_CONTENT.padding,
  "--summary-word-gap": CARD_CONTENT.gap,
};

// How far a line's ink rises above its role's cap height and falls below its baseline, in base px.
export interface LineInk {
  readonly fall: number;
  readonly rise: number;
}

// The ink of text set in the UI font at a type role.
export type InkMeasure = (
  role: { readonly size: number; readonly weight: number },
  text: string,
) => LineInk;

// Measures text's ink in the loaded UI font through a 2D canvas. Without one, a line's ink is
// taken as its cap height above the baseline and the font's descent below it.
export function canvasInk(document: Document): InkMeasure {
  const context = document.createElement("canvas").getContext("2d");
  return ({ size, weight }, text) => {
    if (context === null) {
      return { fall: UI_FONT_FACE.descent * size, rise: 0 };
    }
    context.font = `${weight} ${size}px "${UI_FONT_FAMILY}"`;
    const { actualBoundingBoxAscent, actualBoundingBoxDescent } = context.measureText(text);
    return {
      fall: Math.max(0, actualBoundingBoxDescent),
      rise: Math.max(0, actualBoundingBoxAscent - UI_FONT_FACE.capHeight * size),
    };
  };
}

const HEADING_ROLE = { size: FONT_METRICS.compactMainHeading.size, weight: 700 };
const BODY_ROLE = { size: body.size, weight: 400 };

// The margins above each row that leave the rule's gaps between the rows' measured ink, each row
// box trimmed to its cap height and baseline: a row gap between the zone, stage and progress lines,
// the preview and the first metrics, and a group gap from the last metrics to the statement.
export function stageSummaryGaps(measure: InkMeasure, words: StageSummaryWords): LayoutValues {
  const row = (index: number) =>
    [words.stats[index], words.totals[index]].flatMap((entry) =>
      entry === undefined ? [] : [measure(BODY_ROLE, entry.label), measure(BODY_ROLE, entry.value)],
    );
  const zone = measure(HEADING_ROLE, words.zone);
  const stage = measure(BODY_ROLE, words.stage);
  const progress = measure(BODY_ROLE, words.progress);
  const first = Math.max(0, ...row(0).map(({ rise }) => rise));
  const last = Math.max(
    0,
    ...row(Math.max(words.stats.length, words.totals.length) - 1).map(({ fall }) => fall),
  );
  const statement =
    words.statement === undefined
      ? 0
      : Math.max(
          measure(BODY_ROLE, `${words.statement.name}:`).rise,
          measure(BODY_ROLE, words.statement.text).rise,
        );
  const { gap, rowGap } = CARD_CONTENT;
  return {
    "--summary-preview-gap": rowGap + progress.fall,
    "--summary-progress-gap": rowGap + stage.fall + progress.rise,
    "--summary-stage-gap": rowGap + zone.fall + stage.rise,
    "--summary-statement-gap": gap - STAT_BELOW_BASELINE + last + statement,
    "--summary-stats-gap": rowGap - STAT_CAP_TOP + first,
  };
}

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
  writeLayoutProperties(
    { ...STAGE_SUMMARY_LAYOUT, ...stageSummaryGaps(canvasInk(document), words) },
    view,
  );
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
  footer.append(button);
  dialog.append(footer);
  view.append(dialog);
  root.append(view);
  return { continue: button, dialog, preview, root, ...(statement && { statement }) };
}
