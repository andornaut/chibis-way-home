import { Scene } from "phaser";

import { TEXT } from "../data/text.ts";
import { PHONE_EVENTS } from "../pwa/index.ts";
import { createCard } from "../ui/index.ts";
import { bindSceneButtons } from "./domTaps.ts";
import { mountSceneView, sceneDomUi } from "./domUi.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";

export interface ExitData {
  readonly accepted: () => Promise<boolean>;
  readonly cancelled: () => void;
  readonly words: { readonly question: string; readonly title: string };
}

// Confirms a pending platform Back. The caller owns its native continuation, not this card.
export class ExitScene extends Scene {
  private request!: ExitData;
  private decided = false;
  private accepting = false;
  private closeModal: (() => void) | undefined;
  private pending: (accepting: boolean) => void = () => {};

  constructor() {
    super("exit");
  }

  init(data: ExitData): void {
    this.request = data;
    this.decided = false;
    this.accepting = false;
    this.closeModal = undefined;
  }

  create(): void {
    const card = createCard(document, "exit-card", {
      actions: [
        { key: "cancel", label: TEXT.restart.cancel },
        { key: "exit", label: TEXT.start.exit, primary: true },
      ],
      close: TEXT.update.close,
      text: this.request.words.question,
      title: this.request.words.title,
      width: "small",
    });
    card.root.hidden = true;
    this.pending = (accepting) => {
      for (const button of Object.values(card.buttons)) {
        button.disabled = accepting;
      }
      if (card.close !== undefined) {
        card.close.disabled = accepting;
      }
      if (!accepting) {
        card.dialog.focus({ preventScroll: true });
      }
    };
    const input = modalInput(this);
    const backdrop = showModalBackdrop(this);
    const cancel = () => this.decide(false);
    const onBack = (event: Event) => {
      if (this.decided || !this.sys.isActive()) {
        return;
      }
      event.stopImmediatePropagation();
      if (input.accepts(event)) {
        cancel();
      }
    };
    window.addEventListener(PHONE_EVENTS.backPressed, onBack, true);
    const stopButtons = bindSceneButtons(
      input,
      { gate: input },
      [
        { activate: cancel, element: card.buttons.cancel },
        { activate: () => this.decide(true), element: card.buttons.exit },
        ...(card.close === undefined ? [] : [{ activate: cancel, element: card.close }]),
        { activate: cancel, element: card.backdrop },
      ],
      card.root,
    );
    let shown = true;
    this.events.once("shutdown", () => {
      shown = false;
      this.decided = true;
      this.closeModal?.();
      this.closeModal = undefined;
      stopButtons();
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack, true);
    });
    mountSceneView(this, card.root);
    void backdrop.ready.then(() => {
      if (shown && !this.decided) {
        card.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open(
          { backdrop: card.backdrop, close: cancel, isolation: "dialog" },
          card.dialog,
        );
      }
    });
  }

  back(): void {
    void this.decide(false);
  }

  private async decide(accepted: boolean): Promise<void> {
    if (this.decided || this.accepting || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    if (accepted) {
      this.accepting = true;
      this.pending(true);
      let left = false;
      try {
        left = await this.request.accepted();
      } catch {
        // A refused or failed native continuation leaves the confirmation available.
      }
      if (this.decided || !this.sys.isActive()) {
        return;
      }
      if (!left) {
        this.accepting = false;
        this.pending(false);
        return;
      }
    }
    this.decided = true;
    this.closeModal?.();
    this.closeModal = undefined;
    this.scene.stop();
    if (!accepted) {
      this.request.cancelled();
    }
  }
}
