// @vitest-environment happy-dom
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { expect, it } from "vitest";

import { CARD_CONTENT, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { STATS_SCOPE_TEXT, TEXT } from "../../data/text.ts";
import { capTop, FONT_METRICS, UI_FONT_FACE } from "../layout/fontRoles.ts";
import { hitMargin } from "../layout/hitAreas.ts";
import {
  createStageSummary,
  type LineInk,
  stageSummaryGaps,
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
const NO_INK = () => ({ fall: 0, rise: 0 });
const WORDS = {
  ...TURNED_BACK,
  statement: { colour: "tan", name: TEXT.dialogue.speakers.dog!, text: TEXT.dialogue.label },
} satisfies StageSummaryWords;

it("names the summary by its zone, with a sole enabled primary Continue last", () => {
  const view = createStageSummary(document, NO_INK, "summary", WORDS);
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
  const view = createStageSummary(document, NO_INK, "summary", WORDS);
  expect(
    [...view.dialog.querySelectorAll("dl")].map((list) =>
      [...list.querySelectorAll("dt, dd")].map(({ textContent }) => textContent),
    ),
  ).toEqual(
    [WORDS.stats, WORDS.totals].map((rows) => rows.flatMap(({ label, value }) => [label, value])),
  );
});

it("continues from Continue and the statement line, which reads as name, colon and words", () => {
  const view = createStageSummary(document, NO_INK, "summary", WORDS);
  const { name, text } = WORDS.statement;
  expect(view.statement?.textContent).toBe(`${name}: ${text}`);
  expect([...view.dialog.querySelectorAll("[data-continue]")]).toEqual([
    view.statement,
    view.continue,
  ]);
  const turnedBack = createStageSummary(document, NO_INK, "summary", TURNED_BACK);
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

// Each row's box trims to its cap height and baseline, so its margin adds the ink the previous row
// drops below its baseline and the ink this row lifts above its cap height to the rule's gap.
it("leaves the rule's gaps between the rows' measured ink", () => {
  const inks: Readonly<Record<string, LineInk>> = {
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

it("writes the measured gaps on the summary's view", () => {
  const view = createStageSummary(document, () => ({ fall: 2, rise: 1 }), "summary", WORDS);
  const style = view.root.querySelector<HTMLElement>(".stage-summary-view")!.style;
  expect(Number(style.getPropertyValue("--summary-stage-gap"))).toBe(CARD_CONTENT.rowGap + 3);
});
