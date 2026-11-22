// @vitest-environment happy-dom
import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { DEV_TEXT } from "../../data/dev.ts";
import { CARD_SCREEN_MARGIN } from "../../data/layout.ts";
import { TEXT } from "../../data/text.ts";
import type { SkillId } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { TOUCH_SETTINGS } from "../settings/touchControls.ts";
import { type CheatsCardWords, createCheatsCard } from "./cheats.ts";
import { UI_LAYOUT } from "./layer.ts";
import { createSettingsCard } from "./settings.ts";

const WORDS: CheatsCardWords = {
  close: DEV_TEXT.cheats.close,
  confirm: DEV_TEXT.resetSave.confirm,
  fps: DEV_TEXT.fps,
  group: DEV_TEXT.cheats.group,
  groupDescription: DEV_TEXT.cheats.groupDescription,
  invulnerable: DEV_TEXT.invulnerable,
  load: DEV_TEXT.load,
  powerUps: Object.fromEntries(
    SKILL_IDS.map((skill) => [
      skill,
      DEV_TEXT.powerUpEnable.replace("{skill}", TEXT.skills[skill].title),
    ]),
  ) as Record<SkillId, string>,
  resetSave: DEV_TEXT.resetSave.action,
  showTipsAgain: DEV_TEXT.showTipsAgain,
  stage: DEV_TEXT.stage,
  state: { off: TEXT.settings.state.off, on: TEXT.settings.state.on },
  title: DEV_TEXT.cheats.title,
  tools: DEV_TEXT.cheats.tools,
  unlockAllPowerUps: DEV_TEXT.unlockAllPowerUps,
  unlockAllZones: DEV_TEXT.unlockAllZones,
  zone: DEV_TEXT.zone,
};

// Vitest blanks CSS imports, so the stylesheets are read from disk.
const rule = (sheet: string, selector: string) =>
  new RegExp(`(?:^|\\n)${selector.replaceAll(".", "\\.")} \\{([^}]*)\\}`, "u").exec(
    readFileSync(new URL(sheet, import.meta.url), "utf8"),
  )?.[1];

// The view's one row is the view's height and a card is no taller than that less the screen margin
// above and below, so a card taller than that shrinks its scroll body and keeps the rest in view.
it("bounds every card at the view less the screen margin above and below", () => {
  expect(rule("ui.css", ".ui-card-view")).toContain("grid-template-rows: minmax(0, 1fr);");
  expect(rule("ui.css", ".ui-card")).toContain(
    "max-height: calc(100% - 2 * var(--ui-unit) * var(--card-screen-margin) * 1px);",
  );
  expect(UI_LAYOUT["--card-screen-margin"]).toBe(CARD_SCREEN_MARGIN);
  const scroll = rule("ui.css", ".ui-card-scroll");
  expect(scroll).toContain("flex: 1 1 auto;");
  expect(scroll).toContain("min-height: 0;");
  expect(scroll).toContain("overflow-y: auto;");
});

it("scrolls only the Cheats groups between the title and Close", () => {
  const view = createCheatsCard(document, "cheats", WORDS, SKILL_IDS);
  const [title, scroller, status, actions, closeX] = view.dialog.children;
  expect(view.dialog.children).toHaveLength(5);
  expect(title?.querySelector("h2")?.textContent).toBe(WORDS.title);
  expect([...view.dialog.querySelectorAll(".ui-card-scroll")]).toEqual([view.scrollBody]);
  expect(scroller).toBe(view.scrollBody);
  expect(status).toBe(view.status);
  expect(actions?.contains(view.close)).toBe(true);
  expect(closeX).toBe(view.closeX);
  const rows = [
    ...Object.values(view.switches),
    ...Object.values(view.pickers),
    ...Object.values(view.actions),
  ];
  expect(rows.every((row) => scroller?.contains(row))).toBe(true);
  expect(scroller?.contains(view.close)).toBe(false);
});

it("keeps the warning above the two Cheats columns, with FPS and unlocks opposite skills", () => {
  const view = createCheatsCard(document, "cheats", WORDS, SKILL_IDS);
  const descriptionId = view.dialog.getAttribute("aria-describedby");
  expect(view.dialog.querySelector(`#${descriptionId}`)?.textContent).toBe(WORDS.groupDescription);
  const [cheats, tools] = view.scrollBody.children;
  expect(cheats?.getAttribute("aria-label")).toBe(WORDS.group);
  const [columns, stageGrid] = cheats!.children;
  const [left, right] = columns!.children;
  expect([...left!.children]).toEqual([
    view.switches.fps,
    view.actions.unlockAllPowerUps,
    view.actions.unlockAllZones,
  ]);
  expect([...right!.children]).toEqual([
    ...SKILL_IDS.map((skill) => view.switches[`powerUp:${skill}`]),
    view.switches.invulnerable,
  ]);
  expect([...stageGrid!.children]).toEqual([
    view.pickers.zone,
    view.pickers.stage,
    view.actions.load,
  ]);
  expect([...tools!.querySelectorAll("button")]).toEqual([
    view.actions.showTipsAgain,
    view.actions.resetSave,
  ]);
});

it("scrolls only the Settings rows between the title and Open Cheats", () => {
  const colours = { cream: 0, ink: 0, navy: 0, white: 0 };
  const view = createSettingsCard(document, colours, "settings", TEXT.settings, {
    build: "build",
    cheats: DEV_TEXT.openCheats,
    install: true,
    switches: [...TOUCH_SETTINGS, "reducedMotion"],
  });
  const scrollers = view.dialog.querySelectorAll(".ui-card-scroll");
  expect(scrollers).toHaveLength(1);
  const [scroller] = scrollers;
  const rows = [...Object.values(view.switches), view.install!];
  expect(rows.every((row) => scroller?.contains(row))).toBe(true);
  for (const fixed of [
    view.dialog.querySelector(".ui-card-title")!,
    view.openCheats!,
    view.close,
  ]) {
    expect(scroller?.contains(fixed)).toBe(false);
  }
});
