// @vitest-environment happy-dom
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { expect, it } from "vitest";

import { CARD_CONTENT, STAGE_SUMMARY, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { STATS_SCOPE_TEXT, TEXT } from "../../data/text.ts";
import { FONT_METRICS, UI_FONT_FACE } from "../layout/fontRoles.ts";
import { hitMargin } from "../layout/hitAreas.ts";
import {
  createStageSummary,
  STAGE_SUMMARY_LAYOUT,
  type StageSummaryWords,
} from "./stageSummary.ts";

const label = (template: string) => template.replace(/\{\w+\}/u, "").trimEnd();
const row = (template: string, value: string) => ({ label: label(template), value });
const TURNED_BACK: StageSummaryWords = {
  continue: TEXT.map.continue,
  progress: TEXT.death.progress,
  stage: TEXT.death.stage,
  stats: [
    row(TEXT.stats.lastAttempt, "1:05"),
    row(TEXT.stats.best, "0:56"),
    row(TEXT.stats.attempts, "2"),
  ],
  totals: [
    row(STATS_SCOPE_TEXT.stageTotal, "2:01"),
    row(STATS_SCOPE_TEXT.zoneTotal, "5:10"),
    row(TEXT.stats.runTotal, "10:10"),
  ],
  zone: TEXT.map.zones.woodland!,
};
const WORDS = {
  ...TURNED_BACK,
  statement: { colour: "tan", name: TEXT.dialogue.speakers.dog!, text: TEXT.dialogue.label },
} satisfies StageSummaryWords;

it("names the summary by its zone, with a sole enabled primary Continue last", () => {
  const view = createStageSummary(document, "summary", WORDS);
  const buttons = [...view.dialog.querySelectorAll("button")];
  expect({
    buttons: buttons.map(({ textContent }) => textContent),
    disabled: view.continue.disabled,
    last: view.dialog.lastElementChild?.contains(view.continue),
    name: view.root.querySelector(`#${view.dialog.getAttribute("aria-labelledby")}`)?.textContent,
    preview: view.preview.alt,
    primary: view.continue.classList.contains("ui-text-button-primary"),
    role: view.dialog.getAttribute("role"),
  }).toEqual({
    buttons: [WORDS.continue],
    disabled: false,
    last: true,
    name: WORDS.zone,
    preview: "",
    primary: true,
    role: "dialog",
  });
});

it("reads the stage's metrics, then the totals, each label before its value", () => {
  const view = createStageSummary(document, "summary", WORDS);
  expect(
    [...view.dialog.querySelectorAll("dl")].map((list) =>
      [...list.querySelectorAll("dt, dd")].map(({ textContent }) => textContent),
    ),
  ).toEqual(
    [WORDS.stats, WORDS.totals].map((rows) => rows.flatMap(({ label, value }) => [label, value])),
  );
});

it("continues from Continue and the statement line, which reads as name, colon and words", () => {
  const view = createStageSummary(document, "summary", WORDS);
  const { name, text } = WORDS.statement;
  expect(view.statement?.textContent).toBe(`${name}: ${text}`);
  expect([...view.dialog.querySelectorAll("[data-continue]")]).toEqual([
    view.statement,
    view.continue,
  ]);
  const turnedBack = createStageSummary(document, "summary", TURNED_BACK);
  expect(turnedBack.statement).toBeUndefined();
  expect([...turnedBack.dialog.querySelectorAll("[data-continue]")]).toEqual([turnedBack.continue]);
});

it("centres Continue's face at y 296 in the page inset, its press area starting at y 284", () => {
  const size = { height: TEXT_BUTTON.height, width: 106 };
  const inset = CARD_CONTENT.padding;
  const [action] = arrangeActions({ width: SCREEN.width - 2 * inset }, [
    { key: "continue", role: "primary", size },
  ]).actions;
  const hit = hitMargin({ ...size, x: 0, y: 0 });
  expect(action).toMatchObject({
    face: { ...size, x: 291, y: 0 },
    outset: { bottom: hit, left: hit, right: hit, top: hit },
  });
  expect(inset + 291 + size.width / 2).toBe(SCREEN.width / 2);
  const top = SCREEN.height - inset - size.height;
  expect([top, top - hit]).toEqual([296, 284]);
});

// The page's rows from the layout properties, at 720x360: every row's ink stays a group gap
// clear of Continue's press area.
it("fits the rows above Continue's press area with the group gap to spare", () => {
  const layout = STAGE_SUMMARY_LAYOUT as Readonly<Record<string, number>>;
  const { body, compactMainHeading } = FONT_METRICS;
  const { capHeight, descent } = UI_FONT_FACE;
  const gap = layout["--summary-row-gap"]!;
  const ascender = layout["--summary-ascender"]!;
  // A text row's box: its cap height down to the font's descent.
  const line = ({ size }: { readonly size: number }) => (capHeight + descent) * size;
  const metrics = 3 * CARD_CONTENT.lineHeight + 2 * CARD_CONTENT.rowGap;
  const rows = [
    layout["--summary-padding"]!,
    line(compactMainHeading),
    gap + ascender + line(body),
    gap + line(body),
    gap + layout["--summary-preview-height"]!,
    gap + ascender - layout["--summary-stat-cap-top"]! + metrics,
    CARD_CONTENT.gap + layout["--summary-stat-descent"]! + ascender + line(body),
  ];
  const bottom = rows.reduce((sum, height) => sum + height, 0);
  expect(gap).toBe(4);
  // The first metric's ascenders sit the row gap below the preview.
  expect(ascender).toBeCloseTo((STAGE_SUMMARY.ascender - capHeight) * body.size);
  expect(bottom).toBeLessThanOrEqual(284 - CARD_CONTENT.gap);
});
