import { Scene } from "phaser";

import { TEXT } from "../data/text.ts";
import { type CardView, createCard } from "../ui/index.ts";
import { bindSceneButtons } from "./domTaps.ts";
import { mountSceneView, sceneDomUi } from "./domUi.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";
import { clearProgress, resetWholeRunStats } from "./save.ts";

// The scene that opens the restart card, the start screen or the celebration: it passes the card
// back while the card shows, and hears when Cancel closes it.
export interface RestartOpener {
  restartClosed(): void;
}

// What the opener launches the card with: its own scene key.
export interface RestartData {
  readonly opener: string;
}

// The card's buttons, in the order the keyboard's focus moves through them; the close X follows.
type Target = "cancel" | "restart";
const TARGETS: readonly Target[] = ["cancel", "restart"];

// The card that asks before Restart clears progress, over the scene that opened it: a question,
// Cancel, Restart, which confirms, and a close X. Restart clears only the progress save and opens
// the map with him on the first zone and nothing completed; Cancel, the close X, back, Escape, P
// and a tap outside the card close it. The card is HTML in the UI layer (src/ui/dom/card.ts),
// shown once the dim of the scenes under it is ready: a button acts when a press lands on it and
// lifts on it; Tab and the arrows move the keyboard's focus through Cancel, Restart and the close
// X, starting on the card itself, and Enter and Space press the focused one (the kit's
// modalLayer). The opener passes this scene back.
export class RestartScene extends Scene {
  private opener = "";
  private decided = false;
  private closeModal: (() => void) | undefined;

  constructor() {
    super("restart");
  }

  init(data: RestartData): void {
    this.opener = data.opener;
    this.decided = false;
    this.closeModal = undefined;
  }

  create(): void {
    const words = TEXT.restart;
    const card: CardView<Target> = createCard(document, "restart-card", {
      actions: TARGETS.map((key) => ({ key, label: words[key] })),
      // The update card's close name: TEXT has no Restart close of its own.
      close: TEXT.update.close,
      text: words.question,
      title: words.title,
    });
    card.root.hidden = true;
    const input = modalInput(this);
    const backdrop = showModalBackdrop(this);
    const guard = { gate: input };
    const stops = [
      bindSceneButtons(
        input,
        guard,
        [
          ...TARGETS.map((target) => ({
            activate: () => this.act(target),
            element: card.buttons[target],
          })),
          ...(card.close === undefined
            ? []
            : [{ activate: () => this.back(), element: card.close }]),
          { activate: () => this.back(), element: card.backdrop },
        ],
        card.root,
      ),
    ];
    let shown = true;
    this.events.once("shutdown", () => {
      shown = false;
      this.closeModal?.();
      this.closeModal = undefined;
      stops.forEach((stop) => stop());
    });
    mountSceneView(this, card.root);
    void backdrop.ready.then(() => {
      if (shown && !this.decided) {
        card.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open(
          { backdrop: card.backdrop, close: () => this.back(), isolation: "dialog" },
          card.dialog,
        );
      }
    });
  }

  // The close X, back, Escape, P and a tap outside the card cancel.
  back(): void {
    if (this.decided || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    this.decided = true;
    this.closeModal?.();
    this.closeModal = undefined;
    this.scene.stop();
    this.openerScene().restartClosed();
  }

  private openerScene(): RestartOpener {
    return this.scene.get(this.opener) as Scene & RestartOpener;
  }

  private act(target: Target): void {
    if (this.decided || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    if (target === "cancel") {
      this.back();
    } else {
      this.decided = true;
      clearProgress();
      resetWholeRunStats();
      this.scene.stop(this.opener);
      this.scene.start("opening");
    }
  }
}
