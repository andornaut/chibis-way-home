import { animationKey, type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { type GameObjects, type Input, Scene } from "phaser";

import { TEXT } from "../data/text";
import type { Rect } from "../data/types";
import { type PressArea, pressedArea } from "../layout/hitAreas";
import { focusRingAround, settingsCard, stepsCard } from "../layout/settingsCard";
import { focusKeyAction, stepFocus } from "../pause/focusInput";
import { BUILD_LABEL } from "../platform/build/buildLabel";
import { type MenuInstallBrowser, offersInstall } from "../platform/pwa/installState";
import { installOffer } from "../pwa/installOffer";
import { TOUCH_SETTINGS, type TouchSetting, touchSettingShown } from "../settings/touchControls";
import {
  addButtonLabel,
  addCardTextIn,
  addSlice,
  BODY_FONT,
  BUTTON,
  type ButtonLabel,
  cardFonts,
  paletteColour,
  placeButtonLabel,
  TITLE_FONT,
} from "./cardParts";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput, onScenePointer } from "./modalInput";
import { catchModalTaps } from "./modalTaps";
import { fitPlayCamera, playPoint } from "./playCamera";

// The scene that opens the settings card, the pause card's or the start screen's: it saves each
// touch setting and shows it as it changes, and shows again when the card closes. It passes the
// card its keys and back while the card shows.
export interface SettingsOpener {
  setTouchSetting(setting: TouchSetting, shown: boolean): void;
  settingsClosed(): void;
}

// What the opener launches the card with: its own scene key.
export interface SettingsData {
  readonly opener: string;
}

// The settings card's controls: the close X, the Install row and each touch setting's row.
type Target = "close" | "install" | TouchSetting;

// The icon on each touch setting's row.
const SETTING_ICONS: Readonly<Record<TouchSetting, string>> = {
  actionButtons: "icon-touch-controls",
  moveControls: "icon-move-controls",
};

// A touch setting's row as drawn: its label and its switch.
interface SettingRow {
  readonly label: GameObjects.BitmapText;
  readonly toggle: GameObjects.Sprite;
}

// The glyph of the button each browser's install steps start from.
const STEPS_GLYPHS: Readonly<Record<MenuInstallBrowser, string>> = {
  firefoxAndroid: "icon-browser-menu",
  ios: "icon-ios-share",
};

// The settings card, which the pause card opens in its place over the same dim, or the start
// screen over itself: the Move controls and Action buttons rows, the Install row while the game
// can be installed,
// and the build label. A row acts when a press lands on it and lifts on it; the close X, back,
// Escape and P close the card, back to the scene that opened it. Install shows the browser's
// install prompt or, for a browser that installs only from its own menu, the install steps card
// in the settings card's place, which the same controls close. Up and Down move the keyboard's
// focus through the controls; Enter and Space press the focused one. The opener passes this
// scene its keys and back.
export class SettingsScene extends Scene {
  private layout!: ReturnType<typeof settingsCard>;
  private stepsLayout!: ReturnType<typeof stepsCard>;
  private card!: GameObjects.Container;
  private closeX!: GameObjects.Sprite;
  private focus: Target | undefined;
  // Art's focus ring round the focused control, while the keyboard has moved the focus.
  private focusRing: GameObjects.NineSlice | undefined;
  // The Install button's face, normal and pressed.
  private installButton: Readonly<Record<"normal" | "pressed", GameObjects.NineSlice>> | undefined;
  private installButtonLabel: ButtonLabel | undefined;
  private installLabel: GameObjects.BitmapText | undefined;
  private opener = "";
  // The control a press landed on, which acts if the press lifts on it too.
  private pressed: Target | undefined;
  private settingRows = new Map<TouchSetting, SettingRow>();
  // The install steps card while it shows.
  private steps: GameObjects.Container | undefined;

  constructor() {
    super("settings");
  }

  init(data: SettingsData): void {
    this.opener = data.opener;
  }

  create(): void {
    fitPlayCamera(this);
    this.focus = undefined;
    this.pressed = undefined;
    this.steps = undefined;
    this.card = this.drawCard(offersInstall(installOffer().state()));
    this.focusRing = undefined;
    this.render();
    this.watchPresses();
    modalInput(this).subscribe(() => {
      this.pressed = undefined;
      this.render();
    });
    catchModalTaps(this, this.cameras.main, {
      close: () => this.back(),
      covered: () => this.covered(),
    });
    // The Install row comes and goes as the game becomes installable or installed.
    const stopWatching = installOffer().onChange(() =>
      this.scene.restart({ opener: this.opener } satisfies SettingsData),
    );
    this.events.once("shutdown", stopWatching);
    if (this.opener !== "pause") {
      showModalBackdrop(this);
    }
  }

  // A key the opener passes on while the card shows.
  key(event: KeyboardEvent): void {
    if (!this.sys.isActive() || !modalInput(this).accepts(event)) {
      return;
    }
    const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
    if (action === "close") {
      this.back();
    } else if (action === "press") {
      if (this.steps !== undefined) {
        this.closeSteps();
      } else if (this.focus !== undefined) {
        this.act(this.focus);
      }
    } else if (action !== undefined) {
      this.focus = stepFocus(this.targets(), this.focus, action);
      this.render();
    }
  }

  // The card on top and its controls' press areas: the install steps card and its close X, or the
  // settings card, with or without its Install row, and each control it shows.
  private covered(): Rect[] {
    if (this.steps !== undefined) {
      return [this.stepsLayout.card, this.stepsLayout.close.hit];
    }
    const card = this.layout.card;
    const hits: Record<Target, Rect> = {
      actionButtons: this.layout.actionButtons.hit,
      close: this.layout.close.hit,
      install: this.layout.install.hit,
      moveControls: this.layout.moveControls.hit,
    };
    return [card, ...this.targets().map((target) => hits[target])];
  }

  // Back, Escape, P and a tap outside it close the install steps card while it shows, and the
  // settings card otherwise.
  back(): void {
    if (!this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    if (this.steps !== undefined) {
      this.closeSteps();
    } else {
      this.close();
    }
  }

  private close(): void {
    this.scene.stop();
    this.openerScene().settingsClosed();
  }

  private openerScene(): SettingsOpener {
    return this.scene.get(this.opener) as Scene & SettingsOpener;
  }

  // The controls the keyboard's focus moves through: the install steps card's close X alone while
  // it shows.
  private targets(): Target[] {
    if (this.steps !== undefined) {
      return ["close"];
    }
    return this.installButton === undefined
      ? [...TOUCH_SETTINGS, "close"]
      : [...TOUCH_SETTINGS, "install", "close"];
  }

  private act(target: Target): void {
    if (target === "close") {
      this.close();
    } else if (target === "install") {
      this.install();
    } else {
      this.openerScene().setTouchSetting(target, !touchSettingShown(target));
      this.render();
    }
  }

  // The browser's install prompt, or the install steps card where the browser installs only
  // from its own menu.
  private install(): void {
    const flow = installOffer();
    void flow.install().then((outcome) => {
      if (outcome === "menuSteps" && flow.menuBrowser !== undefined && this.scene.isActive()) {
        this.openSteps(flow.menuBrowser);
      }
    });
  }

  private openSteps(browser: MenuInstallBrowser): void {
    modalInput(this).invalidate();
    const words = TEXT.settings.installSteps;
    this.stepsLayout = stepsCard(cardFonts(this), words.title, [
      words[browser].first,
      words[browser].second,
    ]);
    const { close, steps } = this.stepsLayout;
    const ink = this.colour("ink");
    const texts = [words[browser].first, words[browser].second];
    const stepObjects = steps.flatMap(({ glyph, text }, index) => [
      this.add
        .image(glyph.x, glyph.y, index === 0 ? STEPS_GLYPHS[browser] : "icon-install")
        .setOrigin(0),
      addCardTextIn(this, BODY_FONT, text, texts[index]!, ink),
    ]);
    this.steps = this.add.container(0, 0, [
      addSlice(this, "ui-settings-card", this.stepsLayout.card),
      addCardTextIn(this, TITLE_FONT, this.stepsLayout.title, words.title, ink),
      this.add.sprite(close.at.x, close.at.y, "ui-close").setOrigin(0),
      ...stepObjects,
    ]);
    this.card.setVisible(false);
    // A keyboard that pressed Install keeps its focus, on the steps card's close X.
    this.focus = this.focus === undefined ? undefined : "close";
    this.render();
  }

  private closeSteps(): void {
    modalInput(this).invalidate();
    this.steps?.destroy();
    this.steps = undefined;
    this.card.setVisible(true);
    this.focus = this.focus === undefined ? undefined : "install";
    this.render();
  }

  private drawCard(installRow: boolean): GameObjects.Container {
    this.layout = settingsCard(cardFonts(this), TEXT.settings, BUILD_LABEL, installRow);
    const { buildLabel, card, close, install } = this.layout;
    const words = TEXT.settings;
    const ink = this.colour("ink");
    const frame = card;
    const objects: GameObjects.GameObject[] = [
      addSlice(this, "ui-settings-card", frame),
      addCardTextIn(this, TITLE_FONT, this.layout.title, words.title, ink),
    ];
    this.settingRows = new Map();
    for (const setting of TOUCH_SETTINGS) {
      const { icon, label, toggle } = this.layout[setting];
      const drawn: SettingRow = {
        label: addCardTextIn(this, BODY_FONT, label, words[setting], ink),
        toggle: this.add.sprite(toggle.x, toggle.y, "ui-switch"),
      };
      this.settingRows.set(setting, drawn);
      objects.push(
        this.add.image(icon.x, icon.y, SETTING_ICONS[setting]),
        drawn.label,
        drawn.toggle,
      );
    }
    this.closeX = this.add.sprite(close.at.x, close.at.y, "ui-close");
    objects.push(this.closeX);
    this.installButton = undefined;
    this.installButtonLabel = undefined;
    this.installLabel = undefined;
    if (installRow) {
      this.installLabel = addCardTextIn(this, BODY_FONT, install.label, words.install, ink);
      const frames = sheetTags(this.cache.json.get(BUTTON.art) as AsepriteSheet);
      const face = (tag: "normal" | "pressed") =>
        addSlice(this, BUTTON.art, install.button, frames.get(tag)?.[0]?.frame);
      this.installButton = { normal: face("normal"), pressed: face("pressed") };
      this.installButtonLabel = addButtonLabel(
        this,
        {
          colour: this.colour(BUTTON.label),
          marked: false,
        },
        install.button,
        words.installButton,
      );
      objects.push(
        this.add.image(install.icon.x, install.icon.y, "icon-install"),
        this.installLabel,
        this.installButton.normal,
        this.installButton.pressed,
        this.installButtonLabel.label,
      );
    }
    const label = addCardTextIn(this, BODY_FONT, buildLabel, BUILD_LABEL, this.colour("dslate"));
    objects.push(label);
    for (const object of objects) {
      (object as GameObjects.Image).setOrigin(0);
    }
    return this.add.container(0, 0, objects);
  }

  // Each control as the setting, the press and the focus leave it.
  private render(): void {
    const pressed = this.pressed;
    // A pressed row's label turns dslate, from ink.
    const label = (target: Target) => this.colour(pressed === target ? "dslate" : "ink");
    for (const [setting, row] of this.settingRows) {
      row.toggle.play(animationKey("ui-switch", touchSettingShown(setting) ? "on" : "off"));
      row.label.setTint(label(setting));
    }
    this.installLabel?.setTint(label("install"));
    this.closeX.play(animationKey("ui-close", pressed === "close" ? "pressed" : "normal"));
    this.installButton?.normal.setVisible(pressed !== "install");
    this.installButton?.pressed.setVisible(pressed === "install");
    if (this.installButtonLabel) {
      placeButtonLabel(pressed === "install", false, this.installButtonLabel);
    }
    this.drawFocus();
  }

  private drawFocus(): void {
    this.focusRing?.destroy();
    this.focusRing =
      this.focus !== undefined
        ? addSlice(this, "ui-focus", focusRingAround(this.focusedRect(this.focus)))
        : undefined;
  }

  // What the focus ring surrounds: a row, or the close X itself.
  private focusedRect(target: Target): Rect {
    if (this.steps !== undefined) {
      return this.stepsLayout.close.art;
    }
    if (target === "close") {
      const { x, y } = this.layout.close.at;
      return { height: this.closeX.height, width: this.closeX.width, x, y };
    }
    return this.layout[target].row;
  }

  private targetAt(pointer: Input.Pointer): Target | undefined {
    const point = playPoint(this, pointer);
    if (this.steps !== undefined) {
      const { close } = this.stepsLayout;
      return pressedArea([{ art: close.art, hit: close.hit, key: "close" as const }], point);
    }
    const { actionButtons, close, install, moveControls } = this.layout;
    const areas: Record<Target, PressArea<Target>> = {
      actionButtons: { art: actionButtons.row, hit: actionButtons.hit, key: "actionButtons" },
      close: { art: close.art, hit: close.hit, key: "close" },
      install: { art: install.row, hit: install.hit, key: "install" },
      moveControls: { art: moveControls.row, hit: moveControls.hit, key: "moveControls" },
    };
    return pressedArea(
      this.targets().map((target) => areas[target]),
      point,
    );
  }

  // A control acts when a press lands on it and lifts on it; on the install steps card the
  // close X closes it.
  private watchPresses(): void {
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.pressed = this.targetAt(pointer);
      this.render();
    });
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => {
      const target = this.pressed;
      this.pressed = undefined;
      this.render();
      if (target === undefined || target !== this.targetAt(pointer)) {
        return;
      }
      if (this.steps !== undefined) {
        this.closeSteps();
      } else {
        this.act(target);
      }
    });
  }

  private colour(name: string): number {
    return paletteColour(this, name);
  }
}
