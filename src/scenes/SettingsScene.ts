import {
  type InstallStepsKind,
  offersInstall,
} from "@andornaut/game-kit/runtime/web/pwa/installState";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { Scene } from "phaser";

import { BUILD_LABEL } from "../buildLabel.ts";
import { DEV_TEXT } from "../data/dev.ts";
import { TEXT } from "../data/text.ts";
import type { SkillId } from "../data/types/index.ts";
import {
  cheatsAvailable,
  developmentSkillOverrides,
  invulnerabilityEnabled,
  setInvulnerability,
  setSkillOverride,
  unlockAllPowerUps,
  unlockAllZones,
} from "../dev/mode.ts";
import { cheatStages } from "../dev/stages.ts";
import { SKILL_IDS } from "../progress/index.ts";
import { installOffer } from "../pwa/installOffer.ts";
import {
  type CheatAction,
  type CheatPicker,
  type CheatsCardView,
  type CheatsCardWords,
  type CheatSwitch,
  createCheatsCard,
  createSettingsCard,
  fpsCounterShown,
  reducedMotion,
  setFpsCounterShown,
  setReducedMotion,
  type SettingsCardView,
  type SettingsSpriteRow,
  type SettingsSwitch,
  showCheats,
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
import { clearSeenTips, resetSave, startCheatSession } from "./save.ts";
import { paletteColour } from "./scenePalette.ts";

// The scene that opens the settings card, the pause card's or the start screen's: it saves each
// touch setting and shows it as it changes, and shows again when the card closes. It passes the
// card back while the card shows. Cheats' Load stage plays a stage, and Reset save returns to the
// start screen, through it; either closes the card without settingsClosed.
export interface SettingsOpener {
  loadStage(stage: string): void;
  returnToStart(): void;
  setTouchSetting(setting: TouchSetting, shown: boolean): void;
  settingsClosed(): void;
}

// The Cheats card's words, from DEV_TEXT and the settings card's state words.
const CHEATS_WORDS: CheatsCardWords = {
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

// A tool's failed save write, by the save store's status.
const WRITE_FAILED: Readonly<Record<"invalid" | "unavailable", string>> = {
  invalid: DEV_TEXT.grantResults.invalid,
  unavailable: DEV_TEXT.grantResults.unavailable,
};

// Whether each Cheats switch is on: a cheat while the session has it, the FPS counter while its
// device setting is on.
function cheatOn(setting: CheatSwitch): boolean {
  if (setting === "fps") {
    return fpsCounterShown();
  }
  if (setting === "invulnerable") {
    return invulnerabilityEnabled();
  }
  const skill = setting.slice("powerUp:".length) as SkillId;
  return developmentSkillOverrides()[skill] === true;
}

// What the opener launches the card with: its own scene key.
export interface SettingsData {
  readonly opener: string;
}

// The settings with a switch row, in the card's order: the touch settings, then Reduced motion.
const SWITCH_SETTINGS: readonly SettingsSwitch[] = [...TOUCH_SETTINGS, "reducedMotion"];

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
// under it and the rows' sprite icons are ready: a row acts when a press lands on it and lifts on
// it; Tab and the arrows move the keyboard's focus, which starts on the card itself, through the
// rows and the close X, and Enter and Space press the focused one (the kit's modalLayer). The
// steps card's focus starts on its close X, so Enter and Space close it. In a browser tab Open
// Cheats opens the Cheats card in the settings card's place (src/ui/dom/cheats.ts,
// gameplay/cheats.md), checked again before every action there; back closes it to the settings
// card, and its Reset save asks on a confirmation card first. The opener passes this scene back.
export class SettingsScene extends Scene {
  private opener = "";
  private closed = false;
  private card: SettingsCardView | undefined;
  private closeModal: (() => void) | undefined;
  // Whether the install steps card shows, and its modal's close.
  private steps = false;
  private closeStepsModal: (() => void) | undefined;
  // The Cheats card, which card shows over the settings card and its modals' closes.
  private cheats: CheatsCardView | undefined;
  private cheatsCard: "closed" | "confirm" | "open" = "closed";
  private closeCheatsModal: (() => void) | undefined;
  private closeConfirmModal: (() => void) | undefined;
  // A tool's save write in progress, during which no other Cheats action acts.
  private writing = false;
  // Load stage's chosen zone and stage, as indexes into cheatStages().
  private zoneChoice = 0;
  private stageChoice = 0;

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
    this.cheats = undefined;
    this.cheatsCard = "closed";
    this.closeCheatsModal = undefined;
    this.closeConfirmModal = undefined;
    this.writing = false;
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
        ...(cheatsAvailable(window) && { cheats: DEV_TEXT.openCheats }),
        install: offersInstall(installOffer().state()),
        switches: SWITCH_SETTINGS,
      },
    );
    this.card = card;
    const cheats = createCheatsCard(document, "cheats-card", CHEATS_WORDS, SKILL_IDS);
    this.cheats = cheats;
    card.view.append(cheats.dialog, cheats.confirm.dialog);
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
    // The settings card's controls act while neither the steps nor the Cheats cards cover it.
    const settingsShown = () => !this.steps && this.cheatsCard === "closed";
    const cheatsShown = () => this.cheatsCard === "open" && !this.writing;
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
          ...(card.openCheats === undefined
            ? []
            : [
                {
                  activate: () => this.act("cheats"),
                  available: settingsShown,
                  element: card.openCheats,
                },
              ]),
          { activate: () => this.act("close"), available: settingsShown, element: card.close },
          ...(Object.entries(cheats.switches) as [CheatSwitch, HTMLButtonElement][]).map(
            ([setting, element]) => ({
              activate: () => this.cheat(() => this.toggleCheat(setting)),
              available: cheatsShown,
              element,
            }),
          ),
          ...(Object.entries(cheats.pickers) as [CheatPicker, HTMLButtonElement][]).map(
            ([picker, element]) => ({
              activate: () => this.cheat(() => this.pick(picker)),
              available: cheatsShown,
              element,
            }),
          ),
          ...(Object.entries(cheats.actions) as [CheatAction, HTMLButtonElement][]).map(
            ([action, element]) => ({
              activate: () => this.cheat(() => this.cheatAction(action)),
              available: cheatsShown,
              element,
            }),
          ),
          ...[cheats.close, cheats.closeX].map((element) => ({
            activate: () => this.back(),
            available: cheatsShown,
            element,
            // This dismissal can reveal the Settings card before the touch's mouse events.
            preventTouchMouseDefault: () => cheatsShown() && input.accepts(),
          })),
          {
            activate: () => this.cheat(() => this.confirmReset()),
            available: () => this.cheatsCard === "confirm" && !this.writing,
            element: cheats.confirm.accept,
          },
          ...[cheats.confirm.cancel, cheats.confirm.close].map((element) => ({
            activate: () => this.back(),
            available: () => this.cheatsCard === "confirm" && !this.writing,
            element,
          })),
          {
            activate: () => this.act("close"),
            available: () => this.steps,
            element: card.steps.close,
          },
          { activate: () => this.back(), element: card.backdrop },
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
      this.closeConfirmModal?.();
      this.closeConfirmModal = undefined;
      this.closeCheatsModal?.();
      this.closeCheatsModal = undefined;
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

  // Back, Escape, P, the close X and a tap outside close the card on top: the Reset save
  // confirmation back to the Cheats card, the Cheats card or the install steps card back to the
  // settings card, and the settings card otherwise.
  back(): void {
    if (this.closed || !this.sys.isActive() || !modalInput(this).accepts() || this.writing) {
      return;
    }
    if (this.cheatsCard === "confirm") {
      this.showCheatsCard("open");
      return;
    }
    if (this.cheatsCard === "open") {
      this.showCheatsCard("closed");
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

  private act(target: "cheats" | "close" | "install" | SettingsSwitch): void {
    if (this.closed || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    if (target === "close") {
      this.back();
    } else if (target === "cheats") {
      if (cheatsAvailable(window)) {
        this.showCheatsCard("open");
      }
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

  // Each switch as its setting leaves it, and each Cheats switch and picker.
  private render(): void {
    if (this.card !== undefined) {
      showSwitches(settingOn, TEXT.settings.state, this.card);
    }
    if (this.cheats !== undefined) {
      const zone = cheatStages()[this.zoneChoice];
      showCheats(
        cheatOn,
        { stage: zone?.stages[this.stageChoice]?.label ?? "", zone: zone?.label ?? "" },
        CHEATS_WORDS.state,
        this.cheats,
      );
    }
  }

  // Cheats opens above Settings. Its Reset save confirmation opens above both cards.
  private showCheatsCard(which: "closed" | "confirm" | "open"): void {
    const card = this.card;
    const cheats = this.cheats;
    if (card === undefined || cheats === undefined) {
      return;
    }
    const from = this.cheatsCard;
    this.cheatsCard = which;
    modalInput(this).invalidate();
    for (const button of card.root.querySelectorAll<HTMLElement>("[data-pressed]")) {
      delete button.dataset.pressed;
    }
    if (from === "confirm") {
      cheats.confirm.dialog.hidden = true;
      const close = this.closeConfirmModal;
      this.closeConfirmModal = undefined;
      close?.();
    }
    if (which === "closed" && from !== "closed") {
      cheats.dialog.hidden = true;
      const close = this.closeCheatsModal;
      this.closeCheatsModal = undefined;
      close?.();
      return;
    }
    if (from === "closed") {
      cheats.status.textContent = "";
    }
    cheats.dialog.hidden = false;
    this.render();
    const modals = sceneDomUi(this)?.modals;
    if (which === "open" && from === "closed") {
      this.closeCheatsModal = modals?.open(
        { backdrop: card.backdrop, close: () => this.back(), isolation: "dialog" },
        cheats.dialog,
      );
    } else if (which === "confirm") {
      cheats.confirm.dialog.hidden = false;
      if (modals !== undefined) {
        // A touch action can open the confirmation before its invoker receives browser focus.
        focusTarget(cheats.actions.resetSave);
        this.closeConfirmModal = modals.open(
          {
            backdrop: card.backdrop,
            close: () => this.back(),
            focus: cheats.confirm.cancel,
            isolation: "dialog",
          },
          cheats.confirm.dialog,
        );
      }
    }
  }

  // Runs a Cheats card action while cheats are available here, checked at each action; in an app
  // window every action is refused.
  private cheat(action: () => void): void {
    if (
      this.closed ||
      this.writing ||
      !this.sys.isActive() ||
      !modalInput(this).accepts() ||
      !cheatsAvailable(window)
    ) {
      return;
    }
    action();
    this.render();
  }

  // A cheat switch starts the cheat session; the FPS counter is a tool and starts none.
  private toggleCheat(setting: CheatSwitch): void {
    const on = !cheatOn(setting);
    if (setting === "fps") {
      setFpsCounterShown(on);
      return;
    }
    startCheatSession();
    if (setting === "invulnerable") {
      setInvulnerability(on);
    } else {
      setSkillOverride(on, setting.slice("powerUp:".length) as SkillId);
    }
  }

  // A picker steps to its next choice, wrapping; a new zone starts at its first stage.
  private pick(picker: CheatPicker): void {
    const zones = cheatStages();
    if (picker === "zone") {
      this.zoneChoice = (this.zoneChoice + 1) % zones.length;
      this.stageChoice = 0;
    } else {
      const stages = zones[this.zoneChoice]?.stages.length ?? 1;
      this.stageChoice = (this.stageChoice + 1) % stages;
    }
  }

  private cheatAction(action: CheatAction): void {
    const status = this.cheats!.status;
    if (action === "load") {
      const stage = cheatStages()[this.zoneChoice]?.stages[this.stageChoice]?.id;
      if (stage !== undefined) {
        startCheatSession();
        this.leaveThrough(() => this.openerScene().loadStage(stage));
      }
    } else if (action === "unlockAllPowerUps") {
      startCheatSession();
      unlockAllPowerUps();
      status.textContent = DEV_TEXT.results.unlockAllPowerUps;
    } else if (action === "unlockAllZones") {
      startCheatSession();
      unlockAllZones();
      status.textContent = DEV_TEXT.results.unlockAllZones;
    } else if (action === "showTipsAgain") {
      this.write(clearSeenTips(), () => {
        status.textContent = DEV_TEXT.results.showTipsAgain;
      });
    } else {
      this.showCheatsCard("confirm");
    }
  }

  // Reset save, confirmed: on success the game returns to the start screen; otherwise the Cheats
  // card shows again with the failure.
  private confirmReset(): void {
    this.write(resetSave(), () => this.leaveThrough(() => this.openerScene().returnToStart()));
  }

  // A tool's save write, during which no Cheats action acts; then saved, or the failure on the
  // Cheats card.
  private write(
    pending: Promise<{ readonly status: "invalid" | "saved" | "unavailable" }>,
    saved: () => void,
  ): void {
    const status = this.cheats!.status;
    this.writing = true;
    status.textContent = "";
    void pending
      .then(
        (result) => result.status,
        () => "unavailable" as const,
      )
      .then((result) => {
        this.writing = false;
        if (this.closed || !this.sys.isActive()) {
          return;
        }
        if (result === "saved") {
          saved();
        } else {
          if (this.cheatsCard === "confirm") {
            this.showCheatsCard("open");
          }
          status.textContent = WRITE_FAILED[result];
        }
        this.render();
      });
  }

  // Closes every card without settingsClosed, then leave hands the game to the opener.
  private leaveThrough(leave: () => void): void {
    this.closed = true;
    this.closeConfirmModal?.();
    this.closeConfirmModal = undefined;
    this.closeCheatsModal?.();
    this.closeCheatsModal = undefined;
    this.closeModal?.();
    this.closeModal = undefined;
    leave();
  }
}
