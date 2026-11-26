import { createFormRows } from "@andornaut/game-kit/runtime/web/ui/dom/formRow";
import { writeLayoutProperties } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import fpsCounterIcon from "../../../art/icons/icon-fps-counter.svg?raw";
import { createGameFormRow } from "../binding/index.ts";
import { SETTINGS_LAYOUT, SETTINGS_ROWS } from "../layout/settingsCard.ts";
import {
  TOUCH_SETTING_ACTIONS,
  TOUCH_SETTINGS,
  type TouchSetting,
} from "../settings/touchControls.ts";
import { createActionIcon } from "./actionHelp.ts";
import { textButton } from "./card.ts";
import { type CardFrame, createCardFrame } from "./cardFrame.ts";
import { createSwitchGlyph } from "./controlGlyphs.ts";

// The settings card in the HTML UI (cardFrame.ts, settings.css): its title, two columns of switch
// rows on the kit's form rows, the touch settings left and the display settings right, the
// Install button under the right column while the game can be installed, the build label, Back in
// the footer and the close X; and in the same view, hidden until Install needs it, the install
// steps card over it, with its title, the browser's steps beside their glyph and its own close X.
// A switch row is one button and its whole press area (role switch, aria-checked, named by its
// label and described by its note): its icons, its label over its note and the switch over
// its state word. Touch rows draw the controls they show or hide as inline control icons; FPS
// counter, Reduced motion and Install use art's icons. The icons are decorative, hidden from
// assistive technology. Install is one standard face holding its icon and label. The keyboard's
// focus moves through the rows in order, then Install, Back and the close X.

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
  // The Install button, while the card shows one.
  readonly install?: HTMLButtonElement;
  // The scene's view, which the UI layer mounts.
  readonly root: HTMLElement;
  readonly steps: {
    readonly close: HTMLButtonElement;
    // The steps card itself: role dialog, named by its title and described by its steps.
    readonly dialog: HTMLElement;
    readonly frame: CardFrame;
    readonly glyph: HTMLImageElement;
    // The steps card's view, hidden while the settings card shows alone.
    readonly root: HTMLElement;
    readonly text: HTMLElement;
  };
  readonly switches: Readonly<Record<SettingsSwitch, HTMLButtonElement>>;
  // Shows each switch on or off as on states it.
  showSwitches(on: (setting: SettingsSwitch) => boolean): void;
}

function isTouchSetting(key: string): key is TouchSetting {
  return (TOUCH_SETTINGS as readonly string[]).includes(key);
}

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
  const sprite = () => {
    const icon = element("img", "settings-icon");
    icon.alt = "";
    return icon;
  };
  const frame = createCardFrame(document, {
    // The rows are their own press targets, with no margin to clear the close X by.
    bodyOutset: 0,
    className: "settings-card",
    close: words.close,
    id,
    title: words.title,
    width: "large",
  });
  writeLayoutProperties(SETTINGS_LAYOUT, frame.root);
  const icons: Partial<Record<SettingsSpriteRow, HTMLImageElement>> = {};
  const on = new Map<SettingsSwitch, boolean>();
  const stateWord = (key: SettingsSwitch) => {
    const enabled = on.get(key) === true;
    return isTouchSetting(key)
      ? words.state[enabled ? "shown" : "hidden"]
      : words.state[enabled ? "on" : "off"];
  };
  const rowIcon = (key: SettingsSwitch): Element => {
    if (isTouchSetting(key)) {
      const controls = element("span", "settings-icons");
      controls.append(
        ...TOUCH_SETTING_ACTIONS[key].map((action) =>
          createActionIcon(document, colours, undefined, action),
        ),
      );
      return controls;
    }
    if (key === "fps") {
      const icon = element("span", "settings-fps-icon");
      icon.innerHTML = fpsCounterIcon;
      return icon;
    }
    const icon = sprite();
    icons[key] = icon;
    return icon;
  };
  // Touch settings fill the left column; the display settings and Install fill the right.
  const columns = element("div", "settings-columns");
  const column = () => {
    const list = createFormRows(document, SETTINGS_ROWS, { className: "switch-rows" });
    const box = element("div", "settings-column");
    box.append(list.element);
    columns.append(box);
    return { box, list: list.element };
  };
  const left = column();
  const right = column();
  const views = rows.switches.map((key) => {
    const view = createGameFormRow(document, {
      className: "ui-button-reset",
      getState: () => ({ checked: on.get(key) === true, value: stateWord(key) }),
      icon: rowIcon(key),
      label: words[key],
      ...(key === "fps" ? {} : { note: words.descriptions[key] }),
      switch: true,
    });
    view.switch!.append(createSwitchGlyph(document));
    (isTouchSetting(key) ? left : right).list.append(view.element);
    return [key, view] as const;
  });
  let install: HTMLButtonElement | undefined;
  if (rows.install) {
    install = textButton(document, words.install);
    install.classList.add("settings-install");
    const icon = sprite();
    icon.setAttribute("aria-hidden", "true");
    icons.install = icon;
    install.querySelector(".ui-text-button-label")!.prepend(icon);
    right.box.append(install);
  }
  const build = element("p", "ui-card-text ui-text-supporting settings-build");
  build.textContent = rows.build;
  frame.content.append(columns, build);
  const back = textButton(document, words.back, true);
  frame.setFooter([back]);
  // The steps card's view sits over the settings card's, under the one backdrop.
  const steps = createCardFrame(document, {
    bodyOutset: 0,
    className: "settings-steps",
    close: words.close,
    id: `${id}-steps`,
    title: "",
    width: "medium",
  });
  steps.backdrop.remove();
  steps.root.hidden = true;
  const stepsBody = element("div", "settings-steps-body");
  const glyph = sprite();
  const stepsText = element("p", "ui-card-text ui-card-paragraph ui-text-body settings-steps-text");
  stepsText.id = `${id}-steps-text`;
  steps.dialog.setAttribute("aria-describedby", stepsText.id);
  stepsBody.append(glyph, stepsText);
  steps.content.append(stepsBody);
  frame.root.append(steps.root);
  return {
    back,
    backdrop: frame.backdrop,
    close: frame.close!,
    dialog: frame.dialog,
    icons,
    ...(install && { install }),
    root: frame.root,
    showSwitches(shown) {
      for (const [key, view] of views) {
        on.set(key, shown(key));
        view.refresh();
      }
    },
    steps: {
      close: steps.close!,
      dialog: steps.dialog,
      frame: steps,
      glyph,
      root: steps.root,
      text: stepsText,
    },
    switches: Object.fromEntries(views.map(([key, view]) => [key, view.element])) as Record<
      SettingsSwitch,
      HTMLButtonElement
    >,
  };
}

// Shows the install steps card over the settings card, with words, and its glyph where it has
// one; or, for undefined, the settings card alone again. No control keeps a pressed look across
// the change.
export function showSteps(
  words: { readonly glyph: boolean; readonly steps: string; readonly title: string } | undefined,
  view: SettingsCardView,
): void {
  const { steps } = view;
  if (words !== undefined) {
    steps.frame.frame.setTitle(words.title);
    steps.text.textContent = words.steps;
    steps.glyph.hidden = !words.glyph;
    steps.dialog.toggleAttribute("data-glyph", words.glyph);
    if (!words.glyph) {
      steps.glyph.removeAttribute("src");
    }
  }
  steps.root.hidden = words === undefined;
  steps.frame.layout();
  for (const button of view.root.querySelectorAll<HTMLElement>("[data-pressed]")) {
    delete button.dataset.pressed;
  }
}
