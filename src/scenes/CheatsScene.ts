import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { Scene } from "phaser";

import { DEV_TEXT } from "../data/dev.ts";
import { TEXT } from "../data/text.ts";
import type { SkillId } from "../data/types/index.ts";
import {
  developmentSkillOverrides,
  invulnerabilityEnabled,
  setInvulnerability,
  setSkillOverride,
  unlockAllPowerUps,
  unlockAllZones,
} from "../dev/mode.ts";
import { cheatStages } from "../dev/stages.ts";
import { SKILL_IDS } from "../progress/index.ts";
import {
  type CheatAction,
  type CheatPicker,
  type CheatsCardView,
  type CheatsCardWords,
  type CheatSwitch,
  createCheatsCard,
  fpsCounterShown,
  setFpsCounterShown,
  showCheats,
} from "../ui/index.ts";
import { bindSceneButtons } from "./domTaps.ts";
import { mountSceneView, sceneDomUi } from "./domUi.ts";
import { modalInput } from "./modalInput.ts";
import { clearSeenTips, resetSave, resetSaveAvailable, startCheatSession } from "./save.ts";

export interface CheatsOpener {
  cheatsClosed(): void;
  loadStage(stage: string): void;
  returnToStart(): void;
}

// The Cheats card's words, from DEV_TEXT and the settings card's state words.
const CHEATS_WORDS: CheatsCardWords = {
  back: TEXT.achievements.back,
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

export class CheatsScene extends Scene {
  private opener = "";
  private closed = false;
  private cheats: CheatsCardView | undefined;
  private confirming = false;
  private closeModal: (() => void) | undefined;
  private closeConfirmModal: (() => void) | undefined;
  private writing = false;
  private zoneChoice = 0;
  private stageChoice = 0;

  constructor() {
    super("cheats");
  }

  init(data: { readonly opener: string }): void {
    this.opener = data.opener;
    this.closed = false;
    this.cheats = undefined;
    this.confirming = false;
    this.closeModal = undefined;
    this.closeConfirmModal = undefined;
    this.writing = false;
  }

  create(): void {
    const cheats = createCheatsCard(document, "cheats-card", CHEATS_WORDS, SKILL_IDS);
    this.cheats = cheats;
    this.refreshResetAvailability(cheats);
    this.render();
    const input = modalInput(this);
    input.open();
    const cheatsShown = () => !this.confirming && !this.writing;
    const confirmationShown = () => this.confirming && !this.writing;
    const stop = bindSceneButtons(
      input,
      { gate: input },
      [
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
            available: () => cheatsShown() && !element.disabled,
            element,
          }),
        ),
        ...[cheats.back, cheats.closeX].map((element) => ({
          activate: () => this.back(),
          available: cheatsShown,
          element,
          // Closing can reveal the invoking card before the touch's mouse events.
          preventTouchMouseDefault: () => cheatsShown() && input.accepts(),
        })),
        {
          activate: () => this.cheat(() => this.confirmReset()),
          available: confirmationShown,
          element: cheats.confirm.accept,
        },
        ...[cheats.confirm.cancel, cheats.confirm.close].map((element) => ({
          activate: () => this.back(),
          available: confirmationShown,
          element,
        })),
        { activate: () => this.back(), element: cheats.backdrop },
      ],
      cheats.root,
    );
    this.events.once("shutdown", () => {
      this.cheats = undefined;
      this.closeCards();
      stop();
    });
    mountSceneView(this, cheats.root);
    this.closeModal = sceneDomUi(this)?.modals.open(
      { backdrop: cheats.backdrop, close: () => this.back(), isolation: "dialog" },
      cheats.dialog,
    );
  }

  back(): void {
    if (!this.acceptsActions()) {
      return;
    }
    if (this.confirming) {
      this.showConfirmation(false);
      return;
    }
    this.leaveThrough(() => {
      this.scene.stop();
      this.openerScene().cheatsClosed();
    });
  }

  private openerScene(): CheatsOpener {
    return this.scene.get(this.opener) as Scene & CheatsOpener;
  }

  private acceptsActions(): boolean {
    return !this.closed && !this.writing && this.sys.isActive() && modalInput(this).accepts();
  }

  private cheat(action: () => void): void {
    if (this.acceptsActions()) {
      action();
      this.render();
    }
  }

  private render(): void {
    if (this.cheats === undefined) {
      return;
    }
    const zone = cheatStages()[this.zoneChoice];
    showCheats(
      cheatOn,
      { stage: zone?.stages[this.stageChoice]?.label ?? "", zone: zone?.label ?? "" },
      CHEATS_WORDS.state,
      this.cheats,
    );
  }

  private showConfirmation(show: boolean): void {
    const cheats = this.cheats!;
    this.confirming = show;
    modalInput(this).invalidate();
    cheats.confirm.dialog.hidden = !show;
    if (!show) {
      const close = this.closeConfirmModal;
      this.closeConfirmModal = undefined;
      close?.();
      return;
    }
    // A touch action can open the confirmation before its invoker receives browser focus.
    focusTarget(cheats.actions.resetSave);
    this.closeConfirmModal = sceneDomUi(this)?.modals.open(
      {
        backdrop: cheats.backdrop,
        close: () => this.back(),
        focus: cheats.confirm.cancel,
        isolation: "dialog",
      },
      cheats.confirm.dialog,
    );
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
    } else if (!this.cheats!.actions.resetSave.disabled) {
      this.showConfirmation(true);
    }
  }

  // Reset save, confirmed: on success the game returns to the start screen; otherwise the Cheats
  // card shows again with the failure.
  private confirmReset(): void {
    if (this.confirming && this.cheats?.actions.resetSave.disabled === false) {
      this.write(resetSave(), () => this.leaveThrough(() => this.openerScene().returnToStart()));
    }
  }

  private refreshResetAvailability(cheats: CheatsCardView): void {
    cheats.actions.resetSave.disabled = true;
    void resetSaveAvailable().then((available) => {
      if (this.cheats === cheats && !this.closed) {
        cheats.actions.resetSave.disabled = !available;
      }
    });
  }

  // A tool's save write, during which no Cheats action acts; then saved, or the failure on the
  // Cheats card.
  private write(
    pending: Promise<{ readonly status: "invalid" | "saved" | "unavailable" }>,
    saved: () => void,
  ): void {
    const cheats = this.cheats!;
    const { status } = cheats;
    this.writing = true;
    status.textContent = "";
    void pending
      .then(
        (result) => result.status,
        () => "unavailable" as const,
      )
      .then((result) => {
        if (this.cheats !== cheats || this.closed) {
          return;
        }
        this.writing = false;
        if (!this.sys.isActive()) {
          return;
        }
        if (result === "saved") {
          saved();
        } else {
          if (this.confirming) {
            this.showConfirmation(false);
          }
          status.textContent = WRITE_FAILED[result];
        }
        if (!this.closed) {
          this.refreshResetAvailability(cheats);
        }
        this.render();
      });
  }

  private closeCards(): void {
    this.closeConfirmModal?.();
    this.closeConfirmModal = undefined;
    this.closeModal?.();
    this.closeModal = undefined;
  }

  private leaveThrough(leave: () => void): void {
    this.closed = true;
    this.closeCards();
    leave();
  }
}
