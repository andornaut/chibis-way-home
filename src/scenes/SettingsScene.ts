import { type InstallStepsKind, offersInstall } from "@andornaut/game-kit/web/pwa/installState";
import { guardClicks, listenOutsideTaps } from "@andornaut/game-kit/web/ui/dom/domPress";
import { Scene } from "phaser";

import { BUILD_LABEL } from "../buildLabel";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import { installOffer } from "../pwa/installOffer";
import {
  createSettingsCard,
  reducedMotion,
  setReducedMotion,
  type SettingsCardView,
  type SettingsSwitch,
  showPresses,
  showSteps,
  showSwitches,
  TOUCH_SETTINGS,
  type TouchSetting,
  touchSettingShown,
} from "../ui";
import { artFrameUrl, mountSceneView, sceneDomUi } from "./domUi";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput } from "./modalInput";

// The scene that opens the settings card, the pause card's or the start screen's: it saves each
// touch setting and shows it as it changes, and shows again when the card closes. It passes the
// card back while the card shows.
export interface SettingsOpener {
  setTouchSetting(setting: TouchSetting, shown: boolean): void;
  settingsClosed(): void;
}

// What the opener launches the card with: its own scene key.
export interface SettingsData {
  readonly opener: string;
}

// The settings with a switch row, in the card's order: the touch settings, then Reduced motion.
const SWITCH_SETTINGS: readonly SettingsSwitch[] = [...TOUCH_SETTINGS, "reducedMotion"];

// The icon on each row, shown once Art's texture is loaded.
const ROW_ICONS: Readonly<Record<"install" | SettingsSwitch, string>> = {
  actionButtons: "icon-touch-controls",
  install: "icon-install",
  moveControls: "icon-move-controls",
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

// Whether a switch row's setting is on: a touch setting while shown, Reduced motion while motion
// is reduced.
function settingOn(setting: SettingsSwitch): boolean {
  return setting === "reducedMotion" ? reducedMotion(window) : touchSettingShown(setting);
}

// The settings card, which the pause card opens in its place over the same dim, or the start
// screen over itself: the Move controls, Action buttons and Reduced motion rows, the Install row
// until the game is installed, and the build label. A switch row toggles its setting, saving it
// at once; a touch setting shows in the opener's dim as it changes. The close X, back, Escape, P
// and a tap outside close the card, back to the scene that opened it. Install shows the browser's
// install prompt where it holds one, otherwise the install steps card for the browser's own
// install steps in the settings card's place, which the same controls close, back to the
// settings card. The card is HTML in the UI layer (src/ui/dom/settings.ts), shown once the dim
// under it and the rows' icons are ready: a row acts when a press lands on it and lifts on it;
// Tab and the arrows move the keyboard's focus, which starts on the card itself, through the rows
// and the close X, and Enter and Space press the focused one (the kit's modalLayer). The steps
// card's focus starts on its close X, so Enter and Space close it. The opener passes this scene
// back.
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
    const card = createSettingsCard(document, "settings-card", words, {
      build: BUILD_LABEL,
      install: offersInstall(installOffer().state()),
      switches: SWITCH_SETTINGS,
    });
    this.card = card;
    card.root.hidden = true;
    for (const setting of SWITCH_SETTINGS) {
      card.switches[setting].addEventListener("click", () => this.act(setting));
    }
    card.install?.addEventListener("click", () => this.act("install"));
    card.close.addEventListener("click", () => this.act("close"));
    card.steps.close.addEventListener("click", () => this.act("close"));
    this.render();
    const icons = Promise.all(
      (Object.entries(card.icons) as ["install" | SettingsSwitch, HTMLImageElement][]).map(
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
    const stops = [
      guardClicks(guard, card.root),
      listenOutsideTaps(guard, TOUCH.tapMaxDistance, () => this.back(), card.backdrop),
      showPresses(() => input.accepts(), card.root),
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
        this.closeModal = sceneDomUi(this)?.modals.open({ close: () => this.back() }, card.dialog);
      }
    });
  }

  // Back, Escape, P, the close X and a tap outside close the install steps card while it shows,
  // and the settings card otherwise.
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
      { close: () => this.back(), focus: card.steps.close },
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

  // Each switch as its setting leaves it.
  private render(): void {
    if (this.card !== undefined) {
      showSwitches(settingOn, this.card);
    }
  }
}
