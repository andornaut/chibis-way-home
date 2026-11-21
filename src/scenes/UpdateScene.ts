import { type Game, Scene } from "phaser";

import { TEXT } from "../data/text.ts";
import { PHONE_EVENTS, startWakeLock, stopWakeLock, updateOffer } from "../pwa/index.ts";
import { type CardView, createCard } from "../ui/index.ts";
import { bindSceneButtons } from "./domTaps.ts";
import { mountSceneView, sceneDomUi } from "./domUi.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";
import type { PauseScene } from "./PauseScene.ts";
import { settleSaves } from "./save.ts";

// The game has entered play once BootScene launches the persistent pause scene; a prompt staged
// earlier waits for it, so the card never shows over boot or the newer-save guard.
const ENTERED = "pause";

// Shows the Update now card over whatever the player is in, pausing every other running scene
// and letting the screen sleep, and resumes them when the card closes.
export function installUpdateModalBridge(game: Game): void {
  let paused: string[] = [];
  let waiting: (() => void) | undefined;
  const show = () => {
    paused = game.scene
      .getScenes(true)
      .filter((scene) => scene.scene.key !== "update" && scene.scene.key !== ENTERED)
      .map((scene) => scene.scene.key);
    for (const key of paused) {
      game.scene.pause(key);
    }
    stopWakeLock();
    game.scene.start("update");
  };
  const unsubscribe = updateOffer.subscribe((shown) => {
    waiting?.();
    waiting = undefined;
    if (shown) {
      if (game.scene.isActive(ENTERED)) {
        show();
        return;
      }
      const entered = () => {
        if (game.scene.isActive(ENTERED)) {
          waiting?.();
          waiting = undefined;
          show();
        }
      };
      game.events.on("poststep", entered);
      waiting = () => game.events.off("poststep", entered);
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
  game.events.once("destroy", () => {
    waiting?.();
    unsubscribe();
  });
}

// The card's buttons, in the order the keyboard's focus moves through them; the close X follows.
// ui.css shows Cancel on the left.
type ButtonAction = "accept" | "cancel";
type Action = ButtonAction | "close";
const BUTTONS: readonly ButtonAction[] = ["accept", "cancel"];

// The card that offers a staged update, over every other scene: its title, Cancel, Update now in
// art's primary button, and a close X. Update now settles the save (settleSaves), then switches to
// the staged build; Cancel, the X, back, Escape and a tap outside the card dismiss it for this
// session. The card is HTML in the UI layer (src/ui/dom/card.ts),
// shown once the dim of the scenes under it is ready, and its buttons act only from then: a
// button acts when a press lands on it and lifts on it; Tab and the arrows move the keyboard's
// focus through Update now, Cancel and the X, starting on the card itself, and Enter and Space
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
      width: "small",
    });
    card.root.hidden = true;
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
      bindSceneButtons(
        input,
        guard,
        [
          ...BUTTONS.map((action) => ({
            activate: () => this.act(action),
            element: card.buttons[action],
          })),
          ...(card.close === undefined
            ? []
            : [{ activate: () => this.act("close"), element: card.close }]),
          { activate: () => updateOffer.defer(), element: card.backdrop },
        ],
        card.root,
      ),
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
    const pause =
      this.scene.isActive("pause") || this.scene.isPaused("pause")
        ? (this.scene.get("pause") as PauseScene)
        : undefined;
    const backdrop = showModalBackdrop(this, pause?.modalBackdropShown() ?? false);
    void backdrop.ready.then(() => {
      this.readyToInteract = shown && this.sys.isActive();
      if (this.readyToInteract) {
        card.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open(
          { backdrop: card.backdrop, close: () => this.defer(), isolation: "dialog" },
          card.dialog,
        );
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
      updateOffer.accept(settleSaves);
    } else {
      updateOffer.defer();
    }
  }
}
