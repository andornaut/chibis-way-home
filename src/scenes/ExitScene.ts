import { Scene } from "phaser";

import { TEXT } from "../data/text.ts";
import { PHONE_EVENTS } from "../pwa/index.ts";
import { createCard } from "../ui/index.ts";
import { bindSceneButtons } from "./domTaps.ts";
import { mountSceneView, sceneDomUi } from "./domUi.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";

export interface ExitData {
  readonly accepted: () => void;
  readonly cancelled: () => void;
  readonly words: { readonly question: string; readonly title: string };
}

// Confirms a pending platform Back. The caller owns its native continuation, not this card.
export class ExitScene extends Scene {
  private request!: ExitData;
  private decided = false;
  private closeModal: (() => void) | undefined;

  constructor() {
    super("exit");
  }

  init(data: ExitData): void {
    this.request = data;
    this.decided = false;
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

  private decide(accepted: boolean): void {
    if (this.decided || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    this.decided = true;
    this.closeModal?.();
    this.closeModal = undefined;
    const continuation = accepted ? this.request.accepted : this.request.cancelled;
    this.scene.stop();
    continuation();
  }
}
