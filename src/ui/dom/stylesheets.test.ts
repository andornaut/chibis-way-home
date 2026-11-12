import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { expect, it } from "vitest";

import { achievementsCardProperties } from "../layout/achievementsCard.ts";
import { SETTINGS_LAYOUT } from "../layout/settingsCard.ts";
import { STAGE_SELECT_LAYOUT } from "../layout/stageSelectCard.ts";
import { ACTION_HELP_PROPERTIES } from "./actionHelp.ts";
import { DEATH_LAYOUT } from "./death.ts";
import { DIALOGUE_FOOTER_LAYOUT, DIALOGUE_PANEL_LAYOUT } from "./dialogue.ts";
import { UI_LAYOUT } from "./layer.ts";
import { PAUSE_LAYOUT, skillPlace } from "./pause.ts";
import { runStatsProperties } from "./runStats.ts";
import { SKILL_DETAILS_LAYOUT } from "./skillDetails.ts";
import { SKILL_DISC_LAYOUT } from "./skillDisc.ts";
import { UI_COLOURS, UI_FRAMES } from "./skin.ts";
import { STAGE_SUMMARY_LAYOUT } from "./stageSummary.ts";

// Vitest blanks CSS imports, so the stylesheets are read from disk.
const DIRECTORY = new URL(".", import.meta.url);
const SHEETS = readdirSync(DIRECTORY)
  .filter((name) => name.endsWith(".css"))
  .map((name) => [name, readFileSync(new URL(name, DIRECTORY), "utf8")] as const);
// The kit's ui.css, which loads first, sets the shared button gaps.
const KIT_CSS = readFileSync(
  createRequire(import.meta.url).resolve("@andornaut/game-kit/web/ui/dom/ui.css"),
  "utf8",
);
const SET = new Set(
  [KIT_CSS, ...SHEETS.map(([, css]) => css)].flatMap((css) =>
    [...css.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name!),
  ),
);
const WRITTEN = new Set(
  [
    UI_LAYOUT,
    SETTINGS_LAYOUT,
    STAGE_SELECT_LAYOUT,
    DEATH_LAYOUT,
    DIALOGUE_FOOTER_LAYOUT,
    DIALOGUE_PANEL_LAYOUT,
    STAGE_SUMMARY_LAYOUT,
    achievementsCardProperties(1),
    runStatsProperties({ columnGap: 0, divider: 2 }),
    ACTION_HELP_PROPERTIES,
    SKILL_DETAILS_LAYOUT,
    SKILL_DISC_LAYOUT,
    PAUSE_LAYOUT,
    skillPlace({ x: 0, y: 0 }),
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
