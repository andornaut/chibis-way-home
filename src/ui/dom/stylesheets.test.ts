import { readdirSync, readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { achievementsCardProperties } from "../layout/achievementsCard";
import { SETTINGS_LAYOUT } from "../layout/settingsCard";
import { STAGE_SELECT_LAYOUT } from "../layout/stageSelectCard";
import { ACTION_HELP_PROPERTIES } from "./actionHelp";
import { DEATH_LAYOUT } from "./death";
import { UI_LAYOUT } from "./layer";
import { runStatsProperties } from "./runStats";
import { SKILL_DETAILS_LAYOUT } from "./skillDetails";
import { SKILL_DISC_LAYOUT } from "./skillDisc";
import { UI_COLOURS, UI_FRAMES } from "./skin";

// Vitest blanks CSS imports, so the stylesheets are read from disk.
const DIRECTORY = new URL(".", import.meta.url);
const SHEETS = readdirSync(DIRECTORY)
  .filter((name) => name.endsWith(".css"))
  .map((name) => [name, readFileSync(new URL(name, DIRECTORY), "utf8")] as const);
const SET = new Set(
  SHEETS.flatMap(([, css]) => [...css.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name!)),
);
const WRITTEN = new Set(
  [
    UI_LAYOUT,
    SETTINGS_LAYOUT,
    STAGE_SELECT_LAYOUT,
    DEATH_LAYOUT,
    achievementsCardProperties(1),
    runStatsProperties({ columnGap: 0, divider: 2 }),
    ACTION_HELP_PROPERTIES,
    SKILL_DETAILS_LAYOUT,
    SKILL_DISC_LAYOUT,
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
