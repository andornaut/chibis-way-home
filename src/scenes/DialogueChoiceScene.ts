import { guardClicks } from "@andornaut/game-kit/web/ui/dom/domPress";
import { Scene } from "phaser";

import { TEXT } from "../data/text.ts";
import type { DialogueChoice } from "../data/types/index.ts";
import {
  type ChoiceCardView,
  createChoiceCard,
  dialogueChoice,
  type ResolvedDialogueChoice,
  showPresses,
} from "../ui/index.ts";
import type { DialogueChoiceOpener } from "./DialogueScene.ts";
import { conversationControls, mountSceneView, sceneDomUi } from "./domUi.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";

export interface DialogueChoiceData {
  readonly choice: DialogueChoice;
}

// A required terminal choice. No default, Skip, close, back or outside-tap dismissal is provided.
// The card is HTML in the UI layer (src/ui/dom/choice.ts), shown once the dim under it is ready,
// in the modal layer with the pause button kept live: an answer acts when a press lands on it and
// lifts on it; Tab and the arrows move the keyboard's focus through the answers, wrapping,
// starting on none, and Enter and Space press the focused one. P and Escape pass on to
// PauseScene, which opens its card over the choice.
export class DialogueChoiceScene extends Scene {
  private choice!: ResolvedDialogueChoice;
  private finished = false;
  private closeModal: (() => void) | undefined;

  constructor() {
    super("dialogueChoice");
  }

  init({ choice }: DialogueChoiceData): void {
    this.choice = dialogueChoice(TEXT.lines, choice);
    this.finished = false;
    this.closeModal = undefined;
  }

  create(): void {
    const card: ChoiceCardView = createChoiceCard(document, "dialogue-choice", this.choice);
    card.root.hidden = true;
    for (const [id, button] of card.buttons) {
      button.addEventListener("click", () => this.select(id));
    }
    const input = modalInput(this);
    const backdrop = showModalBackdrop(this);
    const stops = [
      guardClicks({ gate: input }, card.root),
      showPresses(() => input.accepts(), card.root),
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
      if (shown && !this.finished) {
        card.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open(
          { live: conversationControls(this) },
          card.dialog,
        );
      }
    });
  }

  // Whether the pause card may open over this choice: no answer has been selected.
  pausable(): boolean {
    return !this.finished;
  }

  private select(id: string): void {
    if (this.finished || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    this.finished = true;
    this.closeModal?.();
    this.closeModal = undefined;
    this.scene.stop();
    (this.scene.get("dialogue") as unknown as DialogueChoiceOpener).choiceSelected(id);
  }
}
