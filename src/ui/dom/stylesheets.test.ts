import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { expect, it } from "vitest";

import {
  achievementsCardProperties,
  SETTINGS_LAYOUT,
  STAGE_SELECT_LAYOUT,
} from "../layout/index.ts";
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
const KIT_CSS = [
  "actionGroup.css",
  "controlPresentation.css",
  "controls.css",
  "formRow.css",
  "hudDisc.css",
  "layoutTree.css",
  "modalFrame.css",
  "pager.css",
  "ui.css",
  "uiTheme.css",
]
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

// The kit's components write their own properties on the elements they place.
const KIT_WRITTEN = /^--ui-(action|button|colour|form|hud-disc|modal|pager|switch|text)-[\w-]+$/;

// Every custom property a stylesheet reads is one its view, the layer, the theme, the view
// bridge, the skin or a kit component writes, or one the UI's stylesheets set, so no rule reads a
// value nothing provides.
it.each(SHEETS)("%s reads only custom properties something writes", (_, css) => {
  const read = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name!));
  const provided = (name: string) =>
    SET.has(name) ||
    WRITTEN.has(name) ||
    KIT_WRITTEN.test(name) ||
    /^--ui-(unit|view-\w+|slice-\d+)$/.test(name) ||
    UI_COLOURS.some((colour) => name === `--colour-${colour}`) ||
    UI_FRAMES.some(({ name: frame }) =>
      ["border", "bottom", "image", "left", "right", "slice", "top"].some(
        (part) => name === `--${frame}-${part}`,
      ),
    );
  expect([...read].filter((name) => !provided(name))).toEqual([]);
});

// Each rule's selector and declarations in a stylesheet, without comments.
function rules(css: string): (readonly [string, string])[] {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)].map(
    ([, selector, body]) => [selector!.trim(), body!] as const,
  );
}

// The group that holds controls owns the space between them: no sheet pulls a box back with a
// negative margin.
it.each(SHEETS)("%s spaces its boxes without negative margins", (_, css) => {
  const negative = rules(css).filter(([, body]) =>
    /(?<![\w-])margin(-\w+)?:[^;]*(calc\(\s*-|\*\s*-1|(?<![\w)])-\d)/u.test(body),
  );
  expect(negative.map(([selector]) => selector)).toEqual([]);
});

// Focus shows as the face's fill, never as a ring.
it.each(SHEETS)("%s adds no focus ring", (_, css) => {
  expect(css).not.toMatch(/box-shadow:|outline:\s*(?!\s|none)[^;]+;/u);
});
