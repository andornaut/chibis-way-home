// @vitest-environment happy-dom
import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { DEV_TEXT } from "../../data/dev.ts";
import { TEXT } from "../../data/text.ts";
import type { SkillId } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { type CheatsCardWords, createCheatsCard } from "./cheats.ts";

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

// The view's one row is the view's height and the card is no taller than its row, so a card taller
// than the view shrinks its body, the one scroll container, and keeps its title and Close in view.
it("fits the Cheats card in its view with only the body between title and Close scrolling", () => {
  expect(rule("ui.css", ".ui-card-view")).toContain("grid-template-rows: minmax(0, 1fr);");
  expect(rule("ui.css", ".ui-card")).toContain("max-height: 100%;");
  const body = rule("cheats.css", ".cheats-body");
  expect(body).toContain("flex: 1 1 auto;");
  expect(body).toContain("min-height: 0;");
  expect(body).toContain("overflow-y: auto;");

  const view = createCheatsCard(document, "cheats", WORDS, SKILL_IDS);
  const [title, scroller, status, actions] = view.dialog.children;
  expect(view.dialog.children).toHaveLength(4);
  expect(title?.textContent).toBe(WORDS.title);
  expect(scroller?.className).toBe("cheats-body");
  expect(status).toBe(view.status);
  expect(actions?.contains(view.close)).toBe(true);
  const rows = [
    ...Object.values(view.switches),
    ...Object.values(view.pickers),
    ...Object.values(view.actions),
  ];
  expect(rows.every((row) => scroller?.contains(row))).toBe(true);
  expect(scroller?.contains(view.close)).toBe(false);
});
