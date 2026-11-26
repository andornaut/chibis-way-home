// @vitest-environment happy-dom
import { FORM_ROW_STATE_CLASS } from "@andornaut/game-kit/runtime/web/ui/dom/formRow";
import { expect, it } from "vitest";

import { DEV_TEXT } from "../../data/dev.ts";
import { TEXT } from "../../data/text.ts";
import { TOUCH_SETTINGS } from "../settings/touchControls.ts";
import { type CheatsCardWords, createCheatsCard } from "./cheats.ts";
import { createSettingsCard, type SettingsSwitch, showSteps } from "./settings.ts";

const WORDS = TEXT.settings;
const SWITCHES: readonly SettingsSwitch[] = [...TOUCH_SETTINGS, "fps", "reducedMotion"];
const CHEATS: CheatsCardWords = {
  back: TEXT.achievements.back,
  close: DEV_TEXT.cheats.close,
  invulnerable: DEV_TEXT.invulnerable,
  invulnerableNote: DEV_TEXT.invulnerableNote,
  state: WORDS.state,
  title: DEV_TEXT.cheats.title,
  unlockAllPowerUps: DEV_TEXT.unlockAllPowerUps,
  unlockAllZones: DEV_TEXT.unlockAllZones,
};

// An element's accessible name: its label, or its text without the parts hidden from assistive
// technology.
function name(element: Element): string {
  const label = element.getAttribute("aria-label");
  if (label !== null) {
    return label;
  }
  const labelled = element.getAttribute("aria-labelledby");
  if (labelled !== null) {
    return element.ownerDocument.getElementById(labelled)?.textContent ?? "";
  }
  const shown = element.cloneNode(true) as Element;
  shown.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
  return shown.textContent ?? "";
}

function description(element: Element): string | undefined {
  const id = element.getAttribute("aria-describedby");
  return id === null ? undefined : (element.ownerDocument.getElementById(id)?.textContent ?? "");
}

// The names of a card's buttons in the order the keyboard's focus moves through them.
function focusOrder(dialog: Element): string[] {
  return [...dialog.querySelectorAll("button")]
    .filter((button) => !button.disabled && button.closest("[hidden]") === null)
    .map(name);
}

function settingsCard(install: boolean) {
  const view = createSettingsCard(
    document,
    { cream: 0, ink: 0, navy: 0, white: 0 },
    "settings",
    WORDS,
    { build: "build", install, switches: SWITCHES },
  );
  document.body.replaceChildren(view.root);
  return view;
}

it.each([true, false])(
  "moves the Settings focus through the rows, Install (%s), Back and the close X last",
  (install) => {
    const view = settingsCard(install);
    expect([view.dialog.getAttribute("role"), name(view.dialog)]).toEqual(["dialog", WORDS.title]);
    const closeArt = view.close.querySelector(".ui-close-glyph-slot > svg");
    expect(closeArt?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(closeArt?.getAttribute("aria-hidden")).toBe("true");
    expect(focusOrder(view.dialog)).toEqual([
      WORDS.moveControls,
      WORDS.actionButtons,
      WORDS.fps,
      WORDS.reducedMotion,
      ...(install ? [WORDS.install] : []),
      WORDS.back,
      WORDS.close,
    ]);
  },
);

it("names each Settings switch by its label and describes it by its note", () => {
  const view = settingsCard(false);
  expect(
    SWITCHES.map((setting) => {
      const row = view.switches[setting];
      return [row.getAttribute("role"), name(row), description(row)];
    }),
  ).toEqual([
    ["switch", WORDS.moveControls, WORDS.descriptions.moveControls],
    ["switch", WORDS.actionButtons, WORDS.descriptions.actionButtons],
    ["switch", WORDS.fps, undefined],
    ["switch", WORDS.reducedMotion, WORDS.descriptions.reducedMotion],
  ]);
});

it("shows each Settings switch's state as aria-checked and its decorative state word", () => {
  const view = settingsCard(false);
  const switchArt = (setting: SettingsSwitch) =>
    view.switches[setting].querySelector(".ui-switch > svg");
  const glyphs = SWITCHES.map(switchArt);
  for (const glyph of glyphs) {
    expect(glyph?.getAttribute("viewBox")).toBe("0 0 32 16");
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
  }
  const states = () =>
    SWITCHES.map((setting) => {
      const row = view.switches[setting];
      const word = row.querySelector(`.${FORM_ROW_STATE_CLASS}`)!;
      return [
        row.getAttribute("aria-checked"),
        word.textContent,
        word.closest('[aria-hidden="true"]') !== null,
      ];
    });
  view.showSwitches(() => true);
  expect(states()).toEqual([
    ["true", WORDS.state.shown, true],
    ["true", WORDS.state.shown, true],
    ["true", WORDS.state.on, true],
    ["true", WORDS.state.on, true],
  ]);
  view.showSwitches((setting) => setting === "fps");
  expect(states()).toEqual([
    ["false", WORDS.state.hidden, true],
    ["false", WORDS.state.hidden, true],
    ["true", WORDS.state.on, true],
    ["false", WORDS.state.off, true],
  ]);
  expect(SWITCHES.map(switchArt)).toEqual(glyphs);
});

it("shows the install steps card named by its title and described by its steps, with or without a glyph", () => {
  const view = settingsCard(true);
  const { steps } = view;
  expect(steps.root.hidden).toBe(true);
  const { steps: text, title } = WORDS.installSteps.ios;
  showSteps({ glyph: true, steps: text, title }, view);
  expect({
    described: description(steps.dialog),
    focus: focusOrder(steps.dialog),
    glyph: steps.glyph.hidden,
    name: name(steps.dialog),
    role: steps.dialog.getAttribute("role"),
    shown: !steps.root.hidden,
  }).toEqual({
    described: text,
    focus: [WORDS.close],
    glyph: false,
    name: title,
    role: "dialog",
    shown: true,
  });
  const firefox = WORDS.installSteps.firefoxDesktop;
  showSteps({ glyph: false, ...firefox }, view);
  expect([steps.glyph.hidden, name(steps.dialog), description(steps.dialog)]).toEqual([
    true,
    firefox.title,
    firefox.steps,
  ]);
  showSteps(undefined, view);
  expect(steps.root.hidden).toBe(true);
});

it("moves the Cheats focus through the unlocks, the switch, Back and the close X last", () => {
  const view = createCheatsCard(document, "cheats", CHEATS);
  document.body.replaceChildren(view.root);
  expect([view.dialog.getAttribute("role"), name(view.dialog)]).toEqual(["dialog", CHEATS.title]);
  expect(focusOrder(view.dialog)).toEqual([
    CHEATS.unlockAllPowerUps,
    CHEATS.unlockAllZones,
    CHEATS.invulnerable,
    CHEATS.back,
    CHEATS.close,
  ]);
  expect(view.dialog.querySelectorAll("button:disabled")).toHaveLength(0);
});

it("shows Invincibility as a switch described by its note, with a polite empty feedback line", () => {
  const view = createCheatsCard(document, "cheats", CHEATS);
  document.body.replaceChildren(view.root);
  const row = view.invincibility;
  const state = () => [
    row.getAttribute("aria-checked"),
    row.querySelector(`.${FORM_ROW_STATE_CLASS}`)?.textContent,
  ];
  expect([row.getAttribute("role"), name(row), description(row)]).toEqual([
    "switch",
    CHEATS.invulnerable,
    CHEATS.invulnerableNote,
  ]);
  expect(state()).toEqual(["false", CHEATS.state.off]);
  const glyph = row.querySelector(".ui-switch > svg");
  expect(glyph?.getAttribute("viewBox")).toBe("0 0 32 16");
  view.showInvincibility(true);
  expect(state()).toEqual(["true", CHEATS.state.on]);
  expect(row.querySelector(".ui-switch > svg")).toBe(glyph);
  expect([
    view.status.getAttribute("role"),
    view.status.getAttribute("aria-live"),
    view.status.textContent,
  ]).toEqual(["status", "polite", ""]);
});
