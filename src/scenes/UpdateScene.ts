import { guardClicks, listenOutsideTaps } from "@andornaut/game-kit/web/ui/dom/domPress";
import { type Game, Scene } from "phaser";

import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import { PHONE_EVENTS, startWakeLock, stopWakeLock, updateOffer } from "../pwa";
import { type CardView, createCard, showPresses } from "../ui";
import { mountSceneView, sceneDomUi } from "./domUi";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput } from "./modalInput";

// Pausing the world does not change PWA eligibility: closing this offer cannot reopen it.
export function installUpdateModalBridge(game: Game): void {
  let paused: string[] = [];
  const unsubscribe = updateOffer.subscribe((shown) => {
    if (shown) {
      paused = game.scene
        .getScenes(true)
        .filter((scene) => scene.scene.key !== "update")
        .map((scene) => scene.scene.key);
      for (const key of paused) {
        game.scene.pause(key);
      }
      stopWakeLock();
      game.scene.start("update");
    } else {
      if (game.scene.isActive("update")) {
        game.scene.stop("update");
      }
      for (const key of paused) {
        if (game.scene.isPaused(key)) {
          game.scene.resume(key);
        }
      }
      if (paused.includes("zone")) {
        startWakeLock();
      }
      paused = [];
    }
  });
  game.events.once("destroy", unsubscribe);
}

// The card's buttons, in the order the keyboard's focus moves through them; the close X follows.
type ButtonAction = "accept" | "cancel";
type Action = ButtonAction | "close";
const BUTTONS: readonly ButtonAction[] = ["cancel", "accept"];

// The card that offers a waiting update, over every other scene: its title, Cancel, Update now in
// art's primary button, and a close X. Update now accepts the offer; Cancel, the X, back, Escape
// and a tap outside the card defer it. The card is HTML in the UI layer (src/ui/dom/card.ts),
// shown once the dim of the scenes under it is ready, and its buttons act only from then: a
// button acts when a press lands on it and lifts on it; Tab and the arrows move the keyboard's
// focus through Cancel, Update now and the X, starting on the card itself, and Enter and Space
// press the focused one (the kit's modalLayer). P does nothing here.
export class UpdateScene extends Scene {
  private readyToInteract = false;
  private closeModal: (() => void) | undefined;

  constructor() {
    super("update");
  }

  create(): void {
    this.readyToInteract = false;
    this.closeModal = undefined;
    const words = TEXT.update;
    const card: CardView<ButtonAction> = createCard(document, "update-card", {
      actions: BUTTONS.map((key) => ({ key, label: words[key], primary: key === "accept" })),
      alert: true,
      close: words.close,
      title: words.title,
    });
    card.root.hidden = true;
    for (const action of BUTTONS) {
      card.buttons[action].addEventListener("click", () => this.act(action));
    }
    card.close?.addEventListener("click", () => this.act("close"));
    // P closes other cards in the modal layer, not this one: it stops here, before the layer and
    // Phaser see it.
    const keepP = (event: KeyboardEvent) => {
      if (event.key === "p" || event.key === "P") {
        event.stopPropagation();
      }
    };
    card.dialog.addEventListener("keydown", keepP);
    const input = modalInput(this);
    const guard = { gate: input };
    const back = (event: Event) => {
      if (!modalInput(this).accepts(event)) {
        return;
      }
      event.stopImmediatePropagation();
      updateOffer.defer();
    };
    window.addEventListener(PHONE_EVENTS.backPressed, back, true);
    const stops = [
      guardClicks(guard, card.root),
      listenOutsideTaps(guard, TOUCH.tapMaxDistance, () => updateOffer.defer(), card.backdrop),
      showPresses(() => input.accepts(), card.root),
      () => window.removeEventListener(PHONE_EVENTS.backPressed, back, true),
    ];
    let shown = true;
    this.events.once("shutdown", () => {
      shown = false;
      this.readyToInteract = false;
      this.closeModal?.();
      this.closeModal = undefined;
      stops.forEach((stop) => stop());
    });
    mountSceneView(this, card.root);
    const backdrop = showModalBackdrop(this);
    void backdrop.ready.then(() => {
      this.readyToInteract = shown && this.sys.isActive();
      if (this.readyToInteract) {
        card.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open({ close: () => this.defer() }, card.dialog);
      }
    });
  }

  // Escape defers, while the modal gate accepts.
  private defer(): void {
    if (modalInput(this).accepts()) {
      updateOffer.defer();
    }
  }

  private act(action: Action): void {
    if (!this.readyToInteract) {
      return;
    }
    if (action === "accept") {
      updateOffer.accept();
    } else {
      updateOffer.defer();
    }
  }
}
