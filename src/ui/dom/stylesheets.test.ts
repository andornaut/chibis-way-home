import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { expect, it } from "vitest";

import { achievementsCardProperties } from "../layout/achievementsCard.ts";
import { SETTINGS_LAYOUT } from "../layout/settingsCard.ts";
import { STAGE_SELECT_LAYOUT } from "../layout/stageSelectCard.ts";
import { ACTION_HELP_PROPERTIES } from "./actionHelp.ts";
import { CELEBRATION_DOM_LAYOUT } from "./celebration.ts";
import { DEATH_LAYOUT } from "./death.ts";
import { DIALOGUE_FOOTER_LAYOUT, DIALOGUE_PANEL_LAYOUT } from "./dialogue.ts";
import { UI_LAYOUT } from "./layer.ts";
import { MAP_PROPERTIES, MAP_TITLE_PROPERTIES } from "./map.ts";
import { OPENING_PROPERTIES } from "./opening.ts";
import { PAUSE_LAYOUT } from "./pause.ts";
import { roomPortraitProperties, roomProperties } from "./room.ts";
import { runStatsProperties } from "./runStats.ts";
import { SKILL_DETAILS_LAYOUT } from "./skillDetails.ts";
import { SKILL_DISC_LAYOUT } from "./skillDisc.ts";
import { UI_COLOURS, UI_FRAMES } from "./skin.ts";
import { STAGE_PROGRESS_PROPERTIES } from "./stageProgress.ts";
import { STAGE_SUMMARY_LAYOUT, stageSummaryGaps } from "./stageSummary.ts";
import { startBoxProperties } from "./start.ts";
import { TOUCH_CONTROLS_PROPERTIES } from "./touchControls.ts";

// Vitest blanks CSS imports, so the stylesheets are read from disk.
const DIRECTORY = new URL(".", import.meta.url);
const SHEETS = readdirSync(DIRECTORY)
  .filter((name) => name.endsWith(".css"))
  .map((name) => [name, readFileSync(new URL(name, DIRECTORY), "utf8")] as const);
// The kit's ui.css, which loads first, sets the shared button gaps.
const KIT_CSS = ["ui.css", "controls.css", "controlPresentation.css", "layoutTree.css"]
  .map((name) =>
    readFileSync(
      createRequire(import.meta.url).resolve(`@andornaut/game-kit/runtime/web/ui/dom/${name}`),
      "utf8",
    ),
  )
  .join("\n");
const SET = new Set(
  [KIT_CSS, ...SHEETS.map(([, css]) => css)].flatMap((css) =>
    [...css.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name!),
  ),
);
const WRITTEN = new Set(
  [
    UI_LAYOUT,
    STAGE_PROGRESS_PROPERTIES,
    TOUCH_CONTROLS_PROPERTIES,
    CELEBRATION_DOM_LAYOUT,
    MAP_PROPERTIES,
    MAP_TITLE_PROPERTIES,
    roomProperties(),
    OPENING_PROPERTIES,
    roomPortraitProperties({ height: 0, width: 0 }),
    startBoxProperties({ height: 0, width: 0, x: 0, y: 0 }),
    SETTINGS_LAYOUT,
    STAGE_SELECT_LAYOUT,
    DEATH_LAYOUT,
    DIALOGUE_FOOTER_LAYOUT,
    DIALOGUE_PANEL_LAYOUT,
    STAGE_SUMMARY_LAYOUT,
    stageSummaryGaps(() => ({ fall: 0, rise: 0 }), {
      continue: "",
      progress: "",
      stage: "",
      stats: [],
      totals: [],
      zone: "",
    }),
    achievementsCardProperties(1),
    runStatsProperties({ columnGap: 0, divider: 2 }),
    ACTION_HELP_PROPERTIES,
    SKILL_DETAILS_LAYOUT,
    SKILL_DISC_LAYOUT,
    PAUSE_LAYOUT,
  ].flatMap(Object.keys),
);

// Every custom property a card's stylesheet reads is one its card, the layer, the view bridge or
// the skin writes, or one the UI's stylesheets set, so no rule reads a value nothing provides.
// ui.css is checked against the layer itself (layer.test.ts).
it.each(SHEETS.filter(([name]) => name !== "ui.css"))(
  "%s reads only custom properties something writes",
  (_, css) => {
    const read = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name!));
    const provided = (name: string) =>
      SET.has(name) ||
      WRITTEN.has(name) ||
      /^--ui-(unit|view-\w+|slice-\d+)$/.test(name) ||
      UI_COLOURS.some((colour) => name === `--colour-${colour}`) ||
      UI_FRAMES.some(({ name: frame }) =>
        ["border", "bottom", "image", "left", "right", "slice", "top"].some(
          (part) => name === `--${frame}-${part}`,
        ),
      );
    expect(read.size).toBeGreaterThan(0);
    expect([...read].filter((name) => !provided(name))).toEqual([]);
  },
);

// Neighbouring button faces side by side sit the kit's button gap apart, card actions and stage
// faces alike, each press area reaching half the gap toward the next; the settings rows stack the
// kit's stack gap apart. The pagers' page count is not a button, so its spacing stays the card gap.
it("spaces neighbouring buttons by the button and stack gaps", () => {
  const sheet = (name: string) => SHEETS.find(([sheetName]) => sheetName === name)![1];
  const rule = (css: string, selector: string) =>
    new RegExp(`(?:^|\\n)${selector.replaceAll(".", "\\.")} \\{([^}]*)\\}`, "u").exec(css)?.[1];
  const halfGap = "--half-gap: calc(var(--ui-button-gap) / 2);";
  expect(rule(sheet("ui.css"), ".ui-card-actions")).toContain(halfGap);
  expect(rule(sheet("stageSelect.css"), ".stage-select-page")).toContain(halfGap);
  expect(rule(sheet("settings.css"), ".settings-rows")).toContain(
    "row-gap: var(--ui-stack-button-gap);",
  );
  expect(rule(sheet("achievements.css"), ".achievements-pager")).toContain(
    "--half-gap: calc(var(--ui-unit) * var(--card-gap) / 2 * 1px);",
  );
});

it("centres each standalone action row and keeps its targets clear of the neighbouring face", () => {
  const ui = SHEETS.find(([name]) => name === "ui.css")![1];
  expect(ui).toMatch(/\.ui-action-row \{[^}]*display: flex;[^}]*justify-content: center;/u);
  expect(ui).toMatch(/\.ui-anchored-action \{[^}]*width: max-content;/u);
  expect(ui).toContain(
    ".ui-action-row:has(> .ui-anchored-action:not([hidden]) ~ .ui-anchored-action:not([hidden]))",
  );
});

it("keeps Achievements pagination centred with a separate right-aligned return slot", () => {
  const css = SHEETS.find(([name]) => name === "achievements.css")![1];
  expect(css).toContain("grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);");
  expect(css).toContain(".achievements-footer > .achievements-pager {\n  grid-column: 2;");
  expect(css).toContain(".achievements-return {\n  grid-column: 3;\n  justify-self: end;");
});

it("colours button faces and icons for keyboard focus and forced colours without adding rings", () => {
  const sheet = (name: string) => SHEETS.find(([sheetName]) => sheetName === name)![1];
  const ui = sheet("ui.css");
  expect(ui).toMatch(/\.ui-standard-button[^{}]+:focus-visible\s*\{\s*outline: none;/u);
  expect(ui).toContain("background: var(--button-state-fill) padding-box;");
  expect(ui).toContain("--button-focus-fill: Highlight;");
  expect(ui).toContain("--button-focus-ink: HighlightText;");
  expect(ui).toContain("--button-press-fill: ButtonText;");
  expect(ui).toContain("--button-press-ink: ButtonFace;");
  expect(ui).toContain("color: GrayText;");
  const pause = sheet("pause.css");
  expect(pause).toContain(
    [
      ":is(.pause-button, .start-icon-button):is(:focus-visible, [data-pressed], [data-ui-pressed])",
      "  .navigation-disc {",
      "  --navigation-face: var(--button-state-fill);",
    ].join("\n"),
  );
  expect(pause).toContain("fill: var(--skill-disc-fill, var(--colour-dslate));");
  expect(pause).toContain("fill: var(--skill-disc-fill, var(--colour-yellow));");
  expect(pause).toMatch(
    /\.skill-button:not\(:disabled\):focus-visible \{\s*--skill-disc-fill: var\(--colour-cream\);/u,
  );
  expect(pause).toContain("--skill-disc-ink: GrayText;");
  expect(sheet("start.css")).toContain(".start-icon-face .navigation-disc");
  expect(sheet("stageSelect.css")).toContain("background: var(--button-state-fill) padding-box;");
  expect(sheet("map.css")).toContain("background: var(--button-focus-fill);");
  expect(sheet("settings.css")).toContain("background: var(--button-state-fill);");
  for (const name of [
    "ui.css",
    "pause.css",
    "start.css",
    "stageSelect.css",
    "map.css",
    "settings.css",
  ]) {
    expect(sheet(name)).not.toMatch(/box-shadow:|outline:\s*(?!\s|none)[^;]+;/u);
  }
});
