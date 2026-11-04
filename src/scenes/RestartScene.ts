import { type GameObjects, type Input, Scene } from "phaser";

import { TEXT } from "../data/text";
import { focusKeyAction, type PressArea, pressedArea, restartCard, stepFocus } from "../ui";
import {
  addCardTextIn,
  addSlice,
  addTextButton,
  BODY_FONT,
  cardFonts,
  paletteColour,
  pressTextButton,
  ringFocus,
  type TextButton,
  TITLE_FONT,
} from "./cardParts";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput, onScenePointer } from "./modalInput";
import { catchModalTaps } from "./modalTaps";
import { fitPlayCamera, playPoint } from "./playCamera";
import { clearProgress, resetWholeRunStats } from "./save";

// The scene that opens the restart card, the start screen or the celebration: it passes the card
// its keys and back while the card shows, and hears when Cancel closes it.
export interface RestartOpener {
  restartClosed(): void;
}

// What the opener launches the card with: its own scene key.
export interface RestartData {
  readonly opener: string;
}

// The card's buttons, in the order the keyboard's focus moves through them.
type Target = "cancel" | "restart";
const TARGETS: readonly Target[] = ["cancel", "restart"];

// The card that asks before Restart clears progress, over the scene that opened it: a question,
// Cancel, and Restart, which confirms. Restart clears only the progress save and opens the map
// with him on the first zone and nothing completed; Cancel, back, Escape, P and a tap outside
// the card close it. A
// button acts when a press lands on it and lifts on it; Tab and the arrows move the keyboard's
// focus, and Enter and Space press the focused one. The opener passes this scene its keys and
// back.
export class RestartScene extends Scene {
  private layout!: ReturnType<typeof restartCard>;
  private buttons!: Readonly<Record<Target, TextButton>>;
  private focus: Target | undefined;
  private focusRing: GameObjects.NineSlice | undefined;
  private opener = "";
  private decided = false;
  // The button a press landed on, which acts if the press lifts on it too.
  private pressed: Target | undefined;

  constructor() {
    super("restart");
  }

  init(data: RestartData): void {
    this.opener = data.opener;
    this.decided = false;
    this.focus = undefined;
    this.focusRing = undefined;
    this.pressed = undefined;
  }

  create(): void {
    fitPlayCamera(this);
    this.layout = restartCard(cardFonts(this), TEXT.restart);
    const { card, question } = this.layout;
    const words = TEXT.restart;
    addSlice(this, "ui-settings-card", card);
    addCardTextIn(this, TITLE_FONT, this.layout.title, words.title, paletteColour(this, "ink"));
    addCardTextIn(this, BODY_FONT, question, words.question, paletteColour(this, "ink"));
    this.buttons = {
      cancel: addTextButton(this, this.layout.cancel, words.cancel),
      restart: addTextButton(this, this.layout.restart, words.restart),
    };
    this.render();
    catchModalTaps(this, this.cameras.main, {
      close: () => this.back(),
      covered: () => [this.layout.card, ...TARGETS.map((target) => this.layout[target].hit)],
    });
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.pressed = this.targetAt(pointer);
      this.render();
    });
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => {
      const target = this.pressed;
      this.pressed = undefined;
      this.render();
      if (target !== undefined && target === this.targetAt(pointer)) {
        this.act(target);
      }
    });
    showModalBackdrop(this);
  }

  // A key the opener passes on while the card shows.
  key(event: KeyboardEvent): void {
    if (this.decided || !this.sys.isActive() || !modalInput(this).accepts(event)) {
      return;
    }
    const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
    if (action === "close") {
      this.back();
    } else if (action === "press") {
      if (this.focus !== undefined) {
        this.act(this.focus);
      }
    } else if (action !== undefined) {
      this.focus = stepFocus([...TARGETS], this.focus, action);
      this.render();
    }
  }

  // Back, Escape, P and a tap outside the card cancel.
  back(): void {
    if (this.decided || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    this.decided = true;
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

  private targetAt(pointer: Input.Pointer): Target | undefined {
    const areas: PressArea<Target>[] = TARGETS.map((key) => ({
      art: this.layout[key].button,
      hit: this.layout[key].hit,
      key,
    }));
    return pressedArea(areas, playPoint(this, pointer));
  }

  // Each button as the press leaves it, and art's focus ring round the focused one.
  private render(): void {
    for (const target of TARGETS) {
      pressTextButton(this.buttons[target], this.pressed === target);
    }
    this.focusRing = ringFocus(
      this,
      this.focusRing,
      this.focus === undefined ? undefined : this.layout[this.focus].button,
    );
  }
}
