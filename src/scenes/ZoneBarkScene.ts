import { type GameObjects, Scene } from "phaser";

import { BARK_DURATION_SECONDS, SPEAKERS } from "../data/dialogues";
import { TEXT } from "../data/text";
import type { DialogueLine } from "../data/types";
import { dialogueParagraphs } from "../dialogue/conversation";
import { DIALOGUE_SCREEN } from "../layout/dialogueScreen";
import { drawDialogueParagraph } from "./dialogueParagraph";
import { fitPlayCamera } from "./playCamera";

interface Bark {
  readonly line: DialogueLine;
  readonly onStart?: () => void;
  readonly scheduled: boolean;
}

// Notices stay with the world below every modal and its captured backdrop. No input is owned.
export class ZoneBarkScene extends Scene {
  private queue: Bark[] = [];
  private canPresent = () => false;
  private art: GameObjects.GameObject[] = [];
  private remaining = 0;

  constructor() {
    super("zoneBark");
  }

  init(data: { readonly canPresent: () => boolean }): void {
    this.canPresent = data.canPresent;
    this.queue = [];
    this.art = [];
    this.remaining = 0;
  }

  create(): void {
    fitPlayCamera(this);
    this.scene.moveAbove("zone", this.scene.key);
    this.events.once("shutdown", () => {
      this.queue = [];
      this.art = [];
      this.remaining = 0;
    });
  }

  reset(): void {
    this.queue = [];
    this.art.forEach((object) => object.destroy());
    this.art = [];
    this.remaining = 0;
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
      this.art.forEach((object) => object.destroy());
      this.art = [];
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
