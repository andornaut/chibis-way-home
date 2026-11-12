import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { SETTINGS_LAYOUT } from "../layout/settingsCard.ts";
import {
  TOUCH_SETTING_ACTIONS,
  TOUCH_SETTINGS,
  type TouchSetting,
} from "../settings/touchControls.ts";
import { createActionIcon } from "./actionHelp.ts";
import { closeButton } from "./card.ts";

// The settings card in the HTML UI (settings.css, on ui.css's .ui-card): its title, a switch row
// for each setting, the Install row while the game can be installed, the build label and the close
// X; and in the same view, hidden until Install needs it, the install steps card in its place,
// with its title, the browser's steps beside their glyph and its own close X. Each row is one
// button and its whole press area: a switch row (role switch, aria-checked, named by its label)
// holds its icons, label and art's ui-switch; the Install row (named by its label) holds its icon,
// label and art's ui-button face. A touch setting's row draws the controls it shows or hides as
// inline control icons, and under its label the note that touch still works when hidden, which
// describes its switch; every other row's icon is art's sprite. The icons are decorative, hidden
// from assistive technology. The close X comes last, so the keyboard's focus moves through the
// rows in order, then the close X.

export type SettingsSwitch = "reducedMotion" | TouchSetting;

// The rows whose icon is art's sprite: every row but the touch settings'.
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
  readonly close: string;
  readonly install: string;
  readonly installButton: string;
  readonly moveControls: string;
  readonly reducedMotion: string;
  readonly title: string;
  readonly touchStillWorks: string;
}

export interface SettingsCardView {
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

// The card for words, with a switch row for each of switches in that order, then the Install row
// where install holds, then the build label, its control icons in colours; its dialogs identified
// by id and `${id}-steps`, which their titles', rows' and text's ids extend.
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
  const dialogFor = (dialogId: string, title: string, className: string) => {
    const dialog = element("section", `ui-card ui-frame ui-card-closeable ${className}`);
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
  const { dialog } = dialogFor(id, words.title, "settings-card");
  const list = element("div", "settings-rows");
  const icons: Partial<Record<SettingsSpriteRow, HTMLImageElement>> = {};
  // A row's button with its icons and its name: its label, which names it, and on a touch row the
  // note under it, which describes it.
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
    } else {
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
    if (isTouchSetting(key)) {
      const note = text("span", "settings-note", words.touchStillWorks);
      note.id = `${id}-${key}-note`;
      button.setAttribute("aria-describedby", note.id);
      name.append(note);
    }
    button.append(slot, name);
    list.append(button);
    return button;
  };
  const switches = Object.fromEntries(
    rows.switches.map((key) => {
      const button = row(key);
      button.setAttribute("role", "switch");
      button.setAttribute("aria-checked", "false");
      const toggle = element("span", "settings-switch");
      toggle.setAttribute("aria-hidden", "true");
      button.append(toggle);
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
  const close = closeButton(document, words.close);
  dialog.append(list, text("p", "ui-card-text settings-build", rows.build), close);
  const steps = dialogFor(`${id}-steps`, "", "settings-steps");
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
  view: SettingsCardView,
): void {
  for (const [setting, button] of Object.entries(view.switches) as [
    SettingsSwitch,
    HTMLButtonElement,
  ][]) {
    button.setAttribute("aria-checked", String(on(setting)));
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
  view.dialog.hidden = words !== undefined;
  for (const button of view.root.querySelectorAll<HTMLElement>("[data-pressed]")) {
    delete button.dataset.pressed;
  }
}
