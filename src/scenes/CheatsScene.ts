import { Scene } from "phaser";

import { DEV_TEXT } from "../data/dev.ts";
import { TEXT } from "../data/text.ts";
import {
  invulnerabilityEnabled,
  setInvulnerability,
  unlockAllPowerUps,
  unlockAllZones,
} from "../dev/mode.ts";
import {
  type CheatAction,
  type CheatsCardView,
  type CheatsCardWords,
  createCheatsCard,
  showCheats,
} from "../ui/index.ts";
import { bindSceneButtons } from "./domTaps.ts";
import { mountSceneView, sceneDomUi } from "./domUi.ts";
import { modalInput } from "./modalInput.ts";
import { startCheatSession } from "./save.ts";

export interface CheatsOpener {
  cheatsClosed(): void;
}

const CHEATS_WORDS: CheatsCardWords = {
  back: TEXT.achievements.back,
  close: DEV_TEXT.cheats.close,
  groupDescription: DEV_TEXT.cheats.groupDescription,
  invulnerable: DEV_TEXT.invulnerable,
  invulnerableNote: DEV_TEXT.invulnerableNote,
  state: TEXT.settings.state,
  title: DEV_TEXT.cheats.title,
  unlockAllPowerUps: DEV_TEXT.unlockAllPowerUps,
  unlockAllZones: DEV_TEXT.unlockAllZones,
};

// Every cheat is run-only. Closing returns to the same invoking Menu or Pause.
export class CheatsScene extends Scene {
  private opener = "pause";
  private closed = false;
  private cheats: CheatsCardView | undefined;
  private closeModal: (() => void) | undefined;

  constructor() {
    super("cheats");
  }

  init(data: { readonly opener: string }): void {
    this.opener = data.opener;
    this.closed = false;
    this.cheats = undefined;
    this.closeModal = undefined;
  }

  create(): void {
    const cheats = createCheatsCard(document, "cheats-card", CHEATS_WORDS);
    this.cheats = cheats;
    this.render();
    const input = modalInput(this);
    input.open();
    const dismiss = { preventTouchMouseDefault: () => this.acceptsActions() };
    const stop = bindSceneButtons(
      input,
      { gate: input },
      [
        ...Object.entries(cheats.actions).map(([action, element]) => ({
          activate: () => this.act(action as CheatAction),
          element,
        })),
        { activate: () => this.toggleInvincibility(), element: cheats.invincibility },
        ...[cheats.back, cheats.closeX, cheats.backdrop].map((element) => ({
          activate: () => this.back(),
          element,
          ...dismiss,
        })),
      ],
      cheats.root,
    );
    this.events.once("shutdown", () => {
      this.cheats = undefined;
      this.closeModal?.();
      this.closeModal = undefined;
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
    this.closed = true;
    this.closeModal?.();
    this.closeModal = undefined;
    this.scene.stop();
    (this.scene.get(this.opener) as Scene & CheatsOpener).cheatsClosed();
  }

  private acceptsActions(): boolean {
    return !this.closed && this.sys.isActive() && modalInput(this).accepts();
  }

  private render(): void {
    if (this.cheats !== undefined) {
      showCheats(invulnerabilityEnabled(), CHEATS_WORDS.state, this.cheats);
    }
  }

  private toggleInvincibility(): void {
    if (!this.acceptsActions()) {
      return;
    }
    startCheatSession();
    setInvulnerability(!invulnerabilityEnabled());
    this.render();
  }

  private act(action: CheatAction): void {
    if (!this.acceptsActions() || this.cheats === undefined) {
      return;
    }
    startCheatSession();
    if (action === "unlockAllPowerUps") {
      unlockAllPowerUps();
      this.cheats.status.textContent = DEV_TEXT.results.unlockAllPowerUps;
    } else {
      unlockAllZones();
      this.cheats.status.textContent = "";
    }
  }
}
