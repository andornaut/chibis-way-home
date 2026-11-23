import {
  type InstallStepsKind,
  offersInstall,
} from "@andornaut/game-kit/runtime/web/pwa/installState";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { Scene } from "phaser";

import { BUILD_LABEL } from "../buildLabel.ts";
import { TEXT } from "../data/text.ts";
import { installOffer } from "../pwa/installOffer.ts";
import {
  createSettingsCard,
  fpsCounterShown,
  reducedMotion,
  setFpsCounterShown,
  setReducedMotion,
  type SettingsCardView,
  type SettingsSpriteRow,
  type SettingsSwitch,
  showSteps,
  showSwitches,
  TOUCH_SETTINGS,
  type TouchSetting,
  touchSettingShown,
} from "../ui/index.ts";
import { bindSceneButtons } from "./domTaps.ts";
import { artFrameUrl, mountSceneView, sceneDomUi } from "./domUi.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";
import { paletteColour } from "./scenePalette.ts";

export interface SettingsOpener {
  setTouchSetting(setting: TouchSetting, shown: boolean): void;
  settingsClosed(): void;
}

// What the opener launches the card with: its own scene key.
export interface SettingsData {
  readonly opener: string;
}

// Keep the touch switches together, followed by the two display preferences.
const SWITCH_SETTINGS: readonly SettingsSwitch[] = [...TOUCH_SETTINGS, "reducedMotion", "fps"];

// The sprite icon on each row but the touch settings', which draw their controls, shown once
// Art's texture is loaded.
const ROW_ICONS: Readonly<Record<SettingsSpriteRow, string>> = {
  install: "icon-install",
  reducedMotion: "icon-reduced-motion",
};

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

function settingOn(setting: SettingsSwitch): boolean {
  switch (setting) {
    case "fps":
      return fpsCounterShown();
    case "reducedMotion":
      return reducedMotion(window);
    default:
      return touchSettingShown(setting);
  }
}

// The settings card, which the pause card opens in its place over the same dim, or the start
// screen over itself: the touch and display switches, the Install row
// until the game is installed, and the build label. A switch row toggles its setting, saving it
// at once; a touch setting shows in the opener's dim as it changes. The close X, back, Escape, P
// and a tap outside close the card, back to the scene that opened it. Install shows the browser's
// install prompt where it holds one, otherwise the install steps card for the browser's own
// install steps in the settings card's place, which the same controls close, back to the
// settings card. The card is HTML in the UI layer (src/ui/dom/settings.ts), shown once the dim
// under it and the rows' sprite icons are ready: a row acts when a press lands on it and lifts on
// it; Tab and the arrows move the keyboard's focus, which starts on the card itself, through the
// rows and the close X, and Enter and Space press the focused one (the kit's modalLayer).
// The steps card's focus starts on its close X, so Enter and Space close it.
export class SettingsScene extends Scene {
  private opener = "";
  private closed = false;
  private card: SettingsCardView | undefined;
  private closeModal: (() => void) | undefined;
  // Whether the install steps card shows, and its modal's close.
  private steps = false;
  private closeStepsModal: (() => void) | undefined;

  constructor() {
    super("settings");
  }

  init(data: SettingsData): void {
    this.opener = data.opener;
    this.closed = false;
    this.card = undefined;
    this.closeModal = undefined;
    this.steps = false;
    this.closeStepsModal = undefined;
  }

  create(): void {
    const words = TEXT.settings;
    const colour = (name: string) => paletteColour(this, name);
    const card = createSettingsCard(
      document,
      { cream: colour("cream"), ink: colour("ink"), navy: colour("navy"), white: colour("white") },
      "settings-card",
      words,
      {
        build: BUILD_LABEL,
        install: offersInstall(installOffer().state()),
        switches: SWITCH_SETTINGS,
      },
    );
    this.card = card;
    card.root.hidden = true;
    this.render();
    const icons = Promise.all(
      (Object.entries(card.icons) as [SettingsSpriteRow, HTMLImageElement][]).map(
        async ([row, icon]) => {
          if (this.textures.exists(ROW_ICONS[row])) {
            icon.src = await artFrameUrl(this, ROW_ICONS[row]);
          }
        },
      ),
    ).catch((error: unknown) => console.warn("The settings icons failed to load", error));
    const input = modalInput(this);
    // The pause card's dim is already under the card, which takes its own scope over the pause
    // card's; the start screen's comes with the scope from the card's own dim.
    let backdrop = Promise.resolve();
    if (this.opener === "pause") {
      input.open();
    } else {
      backdrop = showModalBackdrop(this).ready;
    }
    const guard = { gate: input };
    const settingsShown = () => !this.steps;
    const acceptsDismissal = () => !this.closed && this.sys.isActive() && input.accepts();
    const stops = [
      bindSceneButtons(
        input,
        guard,
        [
          ...SWITCH_SETTINGS.map((setting) => ({
            activate: () => this.act(setting),
            available: settingsShown,
            element: card.switches[setting],
          })),
          ...(card.install === undefined
            ? []
            : [
                {
                  activate: () => this.act("install"),
                  available: settingsShown,
                  element: card.install,
                },
              ]),
          {
            activate: () => this.act("close"),
            available: settingsShown,
            element: card.back,
            preventTouchMouseDefault: () => settingsShown() && acceptsDismissal(),
          },
          {
            activate: () => this.act("close"),
            available: settingsShown,
            element: card.close,
            preventTouchMouseDefault: () => settingsShown() && acceptsDismissal(),
          },
          {
            activate: () => this.act("close"),
            available: () => this.steps,
            element: card.steps.close,
            preventTouchMouseDefault: () => this.steps && acceptsDismissal(),
          },
          {
            activate: () => this.back(),
            element: card.backdrop,
            preventTouchMouseDefault: acceptsDismissal,
          },
        ],
        card.root,
      ),
      // The Install row comes and goes as the game becomes installable or installed.
      installOffer().onChange(() =>
        this.scene.restart({ opener: this.opener } satisfies SettingsData),
      ),
    ];
    let shown = true;
    this.events.once("shutdown", () => {
      shown = false;
      this.closeStepsModal?.();
      this.closeStepsModal = undefined;
      this.closeModal?.();
      this.closeModal = undefined;
      stops.forEach((stop) => stop());
    });
    mountSceneView(this, card.root);
    void Promise.all([backdrop, icons]).then(() => {
      if (shown && !this.closed) {
        card.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open(
          { backdrop: card.backdrop, close: () => this.back(), isolation: "dialog" },
          card.dialog,
        );
      }
    });
  }

  // Dismiss only the top layer, restoring Settings from Install steps.
  back(): void {
    if (this.closed || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    if (this.steps) {
      this.closeSteps();
      return;
    }
    this.closed = true;
    this.closeModal?.();
    this.closeModal = undefined;
    this.scene.stop();
    this.openerScene().settingsClosed();
  }

  private openerScene(): SettingsOpener {
    return this.scene.get(this.opener) as Scene & SettingsOpener;
  }

  private act(target: "close" | "install" | SettingsSwitch): void {
    if (this.closed || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    if (target === "close") {
      this.back();
    } else if (target === "install") {
      this.install();
    } else {
      const on = !settingOn(target);
      if (target === "fps") {
        setFpsCounterShown(on);
      } else if (target === "reducedMotion") {
        setReducedMotion(window, on);
      } else {
        this.openerScene().setTouchSetting(target, on);
      }
      this.render();
    }
  }

  // The browser's install prompt where it holds one, otherwise the install steps card for the
  // browser's own install steps.
  private install(): void {
    const flow = installOffer();
    void flow.install().then((outcome) => {
      if (outcome === "steps" && this.scene.isActive() && !this.closed) {
        this.openSteps(flow.stepsKind);
      }
    });
  }

  private openSteps(kind: InstallStepsKind): void {
    const card = this.card;
    if (card === undefined || this.steps) {
      return;
    }
    if (card.install !== undefined) {
      focusTarget(card.install);
    }
    this.steps = true;
    modalInput(this).invalidate();
    const glyph = STEPS_GLYPHS[kind];
    showSteps({ ...TEXT.settings.installSteps[kind], glyph: glyph !== undefined }, card);
    if (glyph !== undefined) {
      artFrameUrl(this, glyph).then(
        (url) => {
          card.steps.glyph.src = url;
        },
        (error: unknown) => console.warn("The install steps glyph failed to load", error),
      );
    }
    this.closeStepsModal = sceneDomUi(this)?.modals.open(
      {
        backdrop: card.backdrop,
        close: () => this.back(),
        focus: card.steps.close,
        isolation: "dialog",
      },
      card.steps.dialog,
    );
  }

  // Back to the settings card, the keyboard's focus back on the Install row where it was.
  private closeSteps(): void {
    const card = this.card;
    if (card === undefined) {
      return;
    }
    this.steps = false;
    modalInput(this).invalidate();
    showSteps(undefined, card);
    const close = this.closeStepsModal;
    this.closeStepsModal = undefined;
    close?.();
  }

  private render(): void {
    if (this.card !== undefined) {
      showSwitches(settingOn, TEXT.settings.state, this.card);
    }
  }
}
