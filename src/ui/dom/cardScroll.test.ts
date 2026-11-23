// @vitest-environment happy-dom
import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { DEV_TEXT } from "../../data/dev.ts";
import { CARD_SCREEN_MARGIN } from "../../data/layout.ts";
import { TEXT } from "../../data/text.ts";
import { TOUCH_SETTINGS } from "../settings/touchControls.ts";
import { type CheatsCardWords, createCheatsCard } from "./cheats.ts";
import { UI_LAYOUT } from "./layer.ts";
import { createSettingsCard } from "./settings.ts";

const WORDS: CheatsCardWords = {
  back: TEXT.achievements.back,
  close: DEV_TEXT.cheats.close,
  groupDescription: DEV_TEXT.cheats.groupDescription,
  invulnerable: DEV_TEXT.invulnerable,
  invulnerableNote: DEV_TEXT.invulnerableNote,
  state: TEXT.settings.state,
  title: DEV_TEXT.cheats.title,
  unlockAllPowerUps: DEV_TEXT.unlockAllPowerUps,
  unlockAllZones: DEV_TEXT.unlockAllZones,
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

it("fits Cheats as one Medium column with only its two actions, switch, status and navigation", () => {
  const view = createCheatsCard(document, "cheats", WORDS);
  expect(view.dialog.dataset.cardWidth).toBe("medium");
  expect(view.dialog.querySelector(".ui-card-scroll")).toBeNull();
  expect([...view.body.children]).toEqual([
    view.actions.unlockAllPowerUps.parentElement,
    view.invincibility,
  ]);
  expect([...view.actions.unlockAllPowerUps.parentElement!.children]).toEqual([
    view.actions.unlockAllPowerUps,
    view.actions.unlockAllZones,
  ]);
  expect(view.body.contains(view.status)).toBe(false);
  expect(view.body.contains(view.back)).toBe(false);
  expect(
    view.dialog.querySelector(`#${view.dialog.getAttribute("aria-describedby")}`)?.textContent,
  ).toBe(WORDS.groupDescription);
});

it("fits Settings in two non-scrolling columns with fixed navigation", () => {
  const colours = { cream: 0, ink: 0, navy: 0, white: 0 };
  const view = createSettingsCard(document, colours, "settings", TEXT.settings, {
    build: "build",
    install: true,
    switches: [...TOUCH_SETTINGS, "fps", "reducedMotion"],
  });
  const scrollers = view.dialog.querySelectorAll(".ui-card-scroll");
  expect(scrollers).toHaveLength(0);
  expect(view.back).toBeInstanceOf(HTMLButtonElement);
  expect(view.back.closest(".ui-card-actions.settings-footer")?.parentElement).toBe(view.dialog);
  expect(view.back.classList.contains("ui-text-button-primary")).toBe(true);
  expect(view.back.textContent).toBe(TEXT.settings.back);
  const rows = [...Object.values(view.switches), view.install!];
  expect(rows.every((row) => view.dialog.querySelector(".settings-rows")?.contains(row))).toBe(
    true,
  );
  for (const fixed of [view.dialog.querySelector(".ui-card-title")!, view.back, view.close]) {
    expect(view.dialog.querySelector(".settings-rows")?.contains(fixed)).toBe(false);
  }
});
