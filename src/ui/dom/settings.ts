import { writeLayoutProperties } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import type { CardWidth } from "../layout/contentCard.ts";
import { SETTINGS_LAYOUT } from "../layout/settingsCard.ts";
import {
  TOUCH_SETTING_ACTIONS,
  TOUCH_SETTINGS,
  type TouchSetting,
} from "../settings/touchControls.ts";
import { createActionIcon } from "./actionHelp.ts";
import { closeButton, setCardWidth } from "./card.ts";
import { createTextButtonElement } from "./cardElements.ts";

// The settings card in the HTML UI (settings.css, on ui.css's .ui-card): its title, a switch row
// for each setting, the Install row while the game can be installed, the build label, a fixed Back action and the close
// X; and in the same view, hidden until Install needs it, the install steps card in its place,
// with its title, the browser's steps beside their glyph and its own close X. Each row is one
// button and its whole press area: a switch row (role switch, aria-checked, named by its label)
// holds its icons, label and art's ui-switch; the Install row (named by its label) holds its icon,
// label and art's ui-button face. A switch row shows its current state beside the switch and
// can describe its effect under its label. Touch rows draw the controls they show or hide as inline
// control icons; Install and Reduced motion use art sprites. The icons are decorative, hidden
// from assistive technology. The close X comes last, so the keyboard's focus moves through the
// rows in order, then Back and the close X.

export type SettingsSwitch = "fps" | "reducedMotion" | TouchSetting;

// The rows with an art sprite.
export type SettingsSpriteRow = "install" | "reducedMotion";

// The palette colours the touch rows' control icons are drawn in, as 0xrrggbb.
export interface SettingsCardColours {
  readonly cream: number;
  readonly ink: number;
  readonly navy: number;
  readonly white: number;
}

export interface SettingsCardWords {
  readonly actionButtons: string;
  readonly back: string;
  readonly close: string;
  readonly descriptions: Readonly<Record<Exclude<SettingsSwitch, "fps">, string>>;
  readonly fps: string;
  readonly install: string;
  readonly installButton: string;
  readonly moveControls: string;
  readonly reducedMotion: string;
  readonly state: {
    readonly hidden: string;
    readonly off: string;
    readonly on: string;
    readonly shown: string;
  };
  readonly title: string;
}

export interface SettingsCardView {
  readonly back: HTMLButtonElement;
  readonly backdrop: HTMLElement;
  // The settings card itself: role dialog, named by its title.
  readonly dialog: HTMLElement;
  readonly close: HTMLButtonElement;
  // Each sprite row's leading icon, for the caller to set its source.
  readonly icons: Readonly<Partial<Record<SettingsSpriteRow, HTMLImageElement>>>;
  // The Install row, while the card shows one.
  readonly install?: HTMLButtonElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
  readonly steps: {
    readonly close: HTMLButtonElement;
    // The steps card itself: role dialog, named by its title and described by its steps.
    readonly dialog: HTMLElement;
    readonly glyph: HTMLImageElement;
    readonly text: HTMLElement;
    readonly title: HTMLElement;
  };
  readonly switches: Readonly<Record<SettingsSwitch, HTMLButtonElement>>;
}

function isTouchSetting(key: string): key is TouchSetting {
  return (TOUCH_SETTINGS as readonly string[]).includes(key);
}

// Place the existing settings in the left column, with FPS atop the right column and Install
// below it where available. The two columns share the card's scroll body.
export function createSettingsCard(
  document: Document,
  colours: SettingsCardColours,
  id: string,
  words: SettingsCardWords,
  rows: {
    readonly build: string;
    readonly install: boolean;
    readonly switches: readonly SettingsSwitch[];
  },
): SettingsCardView {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const created = document.createElement(tag);
    created.className = className;
    return created;
  };
  const text = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    value: string,
  ) => {
    const created = element(tag, className);
    created.textContent = value;
    return created;
  };
  const dialogFor = (dialogId: string, title: string, className: string, family: CardWidth) => {
    const dialog = element("section", `ui-card ui-frame ui-card-closeable ${className}`);
    setCardWidth(family, dialog);
    dialog.id = dialogId;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-labelledby", `${dialogId}-title`);
    const header = element("div", "ui-card-header");
    const heading = text("h2", "ui-card-title", title);
    heading.id = `${dialogId}-title`;
    header.append(heading);
    dialog.append(header);
    return { dialog, heading };
  };
  const root = element("div", "ui-card-scene");
  writeLayoutProperties(SETTINGS_LAYOUT, root);
  const backdrop = element("div", "ui-backdrop");
  const view = element("div", "ui-view ui-card-view");
  // Large: at medium the rows' wrapped notes leave the card taller than the view less its screen
  // margins. The install steps card over it stays medium.
  const { dialog } = dialogFor(id, words.title, "settings-card", "large");
  const list = element("div", "settings-rows ui-card-scroll");
  const left = element("div", "settings-column");
  const right = element("div", "settings-column");
  list.append(left, right);
  const icons: Partial<Record<SettingsSpriteRow, HTMLImageElement>> = {};
  // A row's button with its icons and its label, which names it. Each switch's note describes
  // its effect; aria-checked exposes the current state without repeating the visible state text.
  const row = (key: "install" | SettingsSwitch) => {
    const button = element("button", "settings-row ui-press");
    button.type = "button";
    const slot = element("span", "settings-icons");
    slot.setAttribute("aria-hidden", "true");
    if (isTouchSetting(key)) {
      slot.append(
        ...TOUCH_SETTING_ACTIONS[key].map((action) =>
          createActionIcon(document, colours, undefined, action),
        ),
      );
    } else if (key !== "fps") {
      const icon = element("img", "settings-icon");
      icon.alt = "";
      icons[key] = icon;
      slot.append(icon);
    }
    const name = element("span", "settings-name");
    const label = text("span", "settings-label", words[key]);
    label.id = `${id}-${key}`;
    button.setAttribute("aria-labelledby", label.id);
    name.append(label);
    if (key !== "install" && key !== "fps") {
      const note = text("span", "settings-note", words.descriptions[key]);
      note.id = `${id}-${key}-note`;
      button.setAttribute("aria-describedby", note.id);
      name.append(note);
    }
    button.append(slot, name);
    (key === "fps" || key === "install" ? right : left).append(button);
    return button;
  };
  const switches = Object.fromEntries(
    rows.switches.map((key) => {
      const button = row(key);
      button.setAttribute("role", "switch");
      button.setAttribute("aria-checked", "false");
      const toggle = element("span", "settings-switch");
      toggle.setAttribute("aria-hidden", "true");
      const value = element("span", "settings-value");
      const state = element("span", "settings-state");
      state.setAttribute("aria-hidden", "true");
      value.append(state, toggle);
      button.append(value);
      return [key, button];
    }),
  ) as Record<SettingsSwitch, HTMLButtonElement>;
  let install: HTMLButtonElement | undefined;
  if (rows.install) {
    install = row("install");
    install.classList.add("settings-install");
    const face = element("span", "ui-text-button-face ui-frame");
    face.append(text("span", "ui-text-button-label", words.installButton));
    install.append(face);
  }
  const back = createTextButtonElement(document, words.back, true);
  const footer = element("div", "ui-card-actions settings-footer");
  footer.append(back);
  const close = closeButton(document, words.close);
  dialog.append(list, text("p", "ui-card-text settings-build", rows.build), footer, close);
  const steps = dialogFor(`${id}-steps`, "", "settings-steps", "medium");
  steps.dialog.hidden = true;
  steps.dialog.setAttribute("aria-describedby", `${id}-steps-text`);
  const body = element("div", "settings-steps-body");
  const glyph = element("img", "settings-icon");
  glyph.alt = "";
  const stepsText = element("p", "ui-card-text settings-steps-text");
  stepsText.id = `${id}-steps-text`;
  body.append(glyph, stepsText);
  const stepsClose = closeButton(document, words.close);
  steps.dialog.append(body, stepsClose);
  view.append(dialog, steps.dialog);
  root.append(backdrop, view);
  return {
    back,
    backdrop,
    close,
    dialog,
    icons,
    ...(install && { install }),
    root,
    steps: {
      close: stepsClose,
      dialog: steps.dialog,
      glyph,
      text: stepsText,
      title: steps.heading,
    },
    switches,
  };
}

// Shows each switch on or off as on states it.
export function showSwitches(
  on: (setting: SettingsSwitch) => boolean,
  words: SettingsCardWords["state"],
  view: SettingsCardView,
): void {
  for (const [setting, button] of Object.entries(view.switches) as [
    SettingsSwitch,
    HTMLButtonElement,
  ][]) {
    const enabled = on(setting);
    button.setAttribute("aria-checked", String(enabled));
    const state = isTouchSetting(setting) ? (enabled ? "shown" : "hidden") : enabled ? "on" : "off";
    button.querySelector<HTMLElement>(".settings-state")!.textContent = words[state];
  }
}

// Shows the install steps card in the settings card's place, with words, and its glyph where it
// has one; or, for undefined, the settings card again. No control keeps a pressed look across the
// change.
export function showSteps(
  words: { readonly glyph: boolean; readonly steps: string; readonly title: string } | undefined,
  view: SettingsCardView,
): void {
  const { steps } = view;
  if (words !== undefined) {
    steps.title.textContent = words.title;
    steps.text.textContent = words.steps;
    steps.glyph.hidden = !words.glyph;
    steps.dialog.toggleAttribute("data-glyph", words.glyph);
    if (!words.glyph) {
      steps.glyph.removeAttribute("src");
    }
  }
  steps.dialog.hidden = words === undefined;
  for (const button of view.root.querySelectorAll<HTMLElement>("[data-pressed]")) {
    delete button.dataset.pressed;
  }
}
