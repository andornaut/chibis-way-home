import { animationKey, type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { buildLabel as formatBuildLabel } from "@andornaut/game-kit/web/build/buildLabel";
import { type InstallStepsKind, offersInstall } from "@andornaut/game-kit/web/pwa/installState";
import { type GameObjects, type Input, Scene } from "phaser";

import { TEXT } from "../data/text";
import type { Rect } from "../data/types";
import { installOffer } from "../pwa/installOffer";
import {
  focusKeyAction,
  focusRingAround,
  type PressArea,
  pressedArea,
  reducedMotion,
  setReducedMotion,
  settingsCard,
  stepFocus,
  stepsCard,
  TOUCH_SETTINGS,
  type TouchSetting,
  touchSettingShown,
} from "../ui";
import {
  addButtonLabel,
  addCardHeading,
  addCardTextIn,
  addSlice,
  BODY_FONT,
  BUTTON,
  type ButtonLabel,
  cardFonts,
  paletteColour,
  placeButtonLabel,
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

// The settings with a switch row, in the card's order: the touch settings, then Reduced motion.
type SwitchSetting = "reducedMotion" | TouchSetting;
const SWITCH_SETTINGS: readonly SwitchSetting[] = [...TOUCH_SETTINGS, "reducedMotion"];

// The settings card's controls: the close X, the Install row and each switch row.
type Target = "close" | "install" | SwitchSetting;

// This build's version and commit, as the card's last line shows them.
const BUILD_LABEL = formatBuildLabel(__APP_VERSION__, __COMMIT__);

// The icon on each switch row, drawn once Art's texture is loaded.
const SETTING_ICONS: Readonly<Record<SwitchSetting, string>> = {
  actionButtons: "icon-touch-controls",
  moveControls: "icon-move-controls",
  reducedMotion: "icon-reduced-motion",
};

// Whether a switch row's setting is on: a touch setting while shown, Reduced motion while motion
// is reduced.
function settingOn(setting: SwitchSetting): boolean {
  return setting === "reducedMotion" ? reducedMotion(window) : touchSettingShown(setting);
}

// A switch row as drawn: its label and its switch.
interface SettingRow {
  readonly label: GameObjects.BitmapText;
  readonly toggle: GameObjects.Sprite;
}

// The glyph beside each kind of browser's install steps: the control they start from, Share, the
// browser menu or the address bar's install glyph. Firefox desktop installs nothing, so has none.
const STEPS_GLYPHS: Readonly<Record<InstallStepsKind, string | undefined>> = {
  chromiumAndroid: "icon-browser-menu",
  chromiumDesktop: "icon-install",
  firefoxAndroid: "icon-browser-menu",
  firefoxDesktop: undefined,
  ios: "icon-ios-share",
  other: "icon-browser-menu",
  safariMac: "icon-browser-menu",
  samsungInternet: "icon-browser-menu",
};

// The settings card, which the pause card opens in its place over the same dim, or the start
// screen over itself: the Move controls, Action buttons and Reduced motion rows, the Install row
// until the game is installed, and the build label. A row acts when a press lands on it and lifts on it; the
// close X, back, Escape and P close the card, back to the scene that opened it. Install shows the
// browser's install prompt where it holds one, otherwise the install steps card for the browser's
// own install steps in the settings card's place, which the same controls close. Up and Down move the keyboard's
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
  private settingRows = new Map<SwitchSetting, SettingRow>();
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
      reducedMotion: this.layout.reducedMotion.hit,
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
      ? [...SWITCH_SETTINGS, "close"]
      : [...SWITCH_SETTINGS, "install", "close"];
  }

  private act(target: Target): void {
    if (target === "close") {
      this.close();
    } else if (target === "install") {
      this.install();
    } else if (target === "reducedMotion") {
      setReducedMotion(window, !reducedMotion(window));
      this.render();
    } else {
      this.openerScene().setTouchSetting(target, !touchSettingShown(target));
      this.render();
    }
  }

  // The browser's install prompt where it holds one, otherwise the install steps card for the
  // browser's own install steps.
  private install(): void {
    const flow = installOffer();
    void flow.install().then((outcome) => {
      if (outcome === "steps" && this.scene.isActive()) {
        this.openSteps(flow.stepsKind);
      }
    });
  }

  private openSteps(kind: InstallStepsKind): void {
    modalInput(this).invalidate();
    const words = TEXT.settings.installSteps[kind];
    const glyph = STEPS_GLYPHS[kind];
    this.stepsLayout = stepsCard(cardFonts(this), glyph !== undefined, words.title, words.steps);
    const { close, steps } = this.stepsLayout;
    this.steps = this.add.container(0, 0, [
      addSlice(this, "ui-settings-card", this.stepsLayout.card),
      addCardHeading(this, this.stepsLayout.title),
      this.add.sprite(close.at.x, close.at.y, "ui-close").setOrigin(0),
      ...(glyph !== undefined && steps.glyph !== undefined
        ? [this.add.image(steps.glyph.x, steps.glyph.y, glyph).setOrigin(0)]
        : []),
      addCardTextIn(this, BODY_FONT, steps.text, steps.lines, this.colour("ink")),
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
      addCardHeading(this, this.layout.title),
    ];
    this.settingRows = new Map();
    for (const setting of SWITCH_SETTINGS) {
      const { icon, label, toggle } = this.layout[setting];
      const drawn: SettingRow = {
        label: addCardTextIn(this, BODY_FONT, label, words[setting], ink),
        toggle: this.add.sprite(toggle.x, toggle.y, "ui-switch"),
      };
      this.settingRows.set(setting, drawn);
      if (this.textures.exists(SETTING_ICONS[setting])) {
        objects.push(this.add.image(icon.x, icon.y, SETTING_ICONS[setting]));
      }
      objects.push(drawn.label, drawn.toggle);
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
      row.toggle.play(animationKey("ui-switch", settingOn(setting) ? "on" : "off"));
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
    const { actionButtons, close, install, moveControls, reducedMotion: motion } = this.layout;
    const areas: Record<Target, PressArea<Target>> = {
      actionButtons: { art: actionButtons.row, hit: actionButtons.hit, key: "actionButtons" },
      close: { art: close.art, hit: close.hit, key: "close" },
      install: { art: install.row, hit: install.hit, key: "install" },
      moveControls: { art: moveControls.row, hit: moveControls.hit, key: "moveControls" },
      reducedMotion: { art: motion.row, hit: motion.hit, key: "reducedMotion" },
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
