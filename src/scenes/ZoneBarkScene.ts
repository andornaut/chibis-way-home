import { containsPoint } from "@andornaut/game-kit/rect";
import { type GameObjects, type Input, Scene } from "phaser";

import { BARK_DURATION_SECONDS, SPEAKERS } from "../data/dialogues";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { DialogueLine } from "../data/types";
import {
  dialogueParagraphs,
  type DialoguePress,
  dialogueTapAction,
  moveDialoguePress,
} from "../dialogue/conversation";
import { DIALOGUE_SCREEN } from "../layout/dialogueScreen";
import { drawDialogueParagraph } from "./dialogueParagraph";
import { modalInput, onScenePointer } from "./modalInput";
import { fitPlayCamera, playPoint } from "./playCamera";

interface Bark {
  readonly line: DialogueLine;
  readonly onStart?: () => void;
  readonly scheduled: boolean;
}

// Notices stay below every modal; only the current panel consumes a fresh dismissal tap.
export class ZoneBarkScene extends Scene {
  private queue: Bark[] = [];
  private canPresent = () => false;
  private art: GameObjects.GameObject[] = [];
  private remaining = 0;
  private press: DialoguePress | undefined;

  constructor() {
    super("zoneBark");
  }

  init(data: { readonly canPresent: () => boolean }): void {
    this.canPresent = data.canPresent;
    this.queue = [];
    this.art = [];
    this.remaining = 0;
    this.press = undefined;
  }

  create(): void {
    fitPlayCamera(this);
    this.scene.moveAbove("zone", this.scene.key);
    this.watchInput();
    modalInput(this).subscribe(() => {
      this.press = undefined;
    });
    this.events.once("shutdown", () => {
      this.queue = [];
      this.art = [];
      this.remaining = 0;
      this.press = undefined;
    });
  }

  reset(): void {
    this.queue = [];
    this.clearCurrent();
  }

  private clearCurrent(): void {
    this.art.forEach((object) => object.destroy());
    this.art = [];
    this.remaining = 0;
    this.press = undefined;
  }

  private watchInput(): void {
    const controls = [
      { art: DIALOGUE_SCREEN.box, hit: DIALOGUE_SCREEN.box, key: "continue" as const },
    ];
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      const at = playPoint(this, pointer);
      if (
        this.press ||
        !this.art.length ||
        !this.canPresent() ||
        !containsPoint(DIALOGUE_SCREEN.box, at.x, at.y)
      ) {
        return;
      }
      this.input.stopPropagation();
      this.press = { at, cancelled: false, control: "continue", id: pointer.id };
    });
    onScenePointer(this, "pointermove", (pointer: Input.Pointer) => {
      if (this.press?.id === pointer.id) {
        this.input.stopPropagation();
        this.press = moveDialoguePress(TOUCH.tapMaxDistance, playPoint(this, pointer), this.press);
      }
    });
    const up = (pointer: Input.Pointer, outside: boolean) => {
      if (this.press?.id !== pointer.id) {
        return;
      }
      this.input.stopPropagation();
      const press = this.press;
      this.press = undefined;
      if (
        !outside &&
        this.canPresent() &&
        dialogueTapAction(controls, TOUCH.tapMaxDistance, press, {
          ...playPoint(this, pointer),
          id: pointer.id,
          wasCanceled: pointer.wasCanceled,
        }) === "advance"
      ) {
        this.clearCurrent();
      }
    };
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => up(pointer, false));
    onScenePointer(this, "pointerupoutside", (pointer: Input.Pointer) => up(pointer, true));
  }

  idle(): boolean {
    return this.queue.length === 0 && this.art.length === 0;
  }

  enqueue(line: DialogueLine): void {
    const firstScheduled = this.queue.findIndex(({ scheduled }) => scheduled);
    this.queue.splice(firstScheduled < 0 ? this.queue.length : firstScheduled, 0, {
      line,
      scheduled: false,
    });
  }

  offer(onStart: () => void, line: DialogueLine): boolean {
    if (!this.idle() || !this.canPresent()) {
      return false;
    }
    this.queue.push({ line, onStart, scheduled: true });
    return true;
  }

  override update(_time: number, delta: number): void {
    if (!this.canPresent()) {
      return;
    }
    if (this.art.length > 0) {
      this.remaining -= delta;
      if (this.remaining > 0) {
        return;
      }
      this.clearCurrent();
    }
    const bark = this.queue.shift();
    if (!bark) {
      return;
    }
    const paragraph = dialogueParagraphs(SPEAKERS, TEXT, { lines: [bark.line] })[0]!;
    this.art = [
      this.add.image(DIALOGUE_SCREEN.box.x, DIALOGUE_SCREEN.box.y, "ui-dialogue-box").setOrigin(0),
      ...drawDialogueParagraph(this, paragraph),
    ];
    this.remaining = BARK_DURATION_SECONDS * 1000;
    bark.onStart?.();
  }
}
