import { type GameObjects, Scene } from "phaser";

import { BARK_DURATION_SECONDS, SPEAKERS } from "../data/dialogues";
import { TEXT } from "../data/text";
import type { DialogueLine } from "../data/types";
import { dialogueParagraphs } from "../dialogue/conversation";
import { DIALOGUE_SCREEN } from "../layout/dialogueScreen";
import { drawDialogueParagraph } from "./dialogueParagraph";
import { fitPlayCamera } from "./playCamera";

// Notices stay with the world below every modal and its captured backdrop. No input is owned.
export class ZoneBarkScene extends Scene {
  private queue: DialogueLine[] = [];
  private art: GameObjects.GameObject[] = [];
  private remaining = 0;

  constructor() {
    super("zoneBark");
  }

  init(): void {
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

  enqueue(line: DialogueLine): void {
    this.queue.push(line);
  }

  override update(_time: number, delta: number): void {
    if (this.art.length > 0) {
      this.remaining -= delta;
      if (this.remaining > 0) {
        return;
      }
      this.art.forEach((object) => object.destroy());
      this.art = [];
    }
    const line = this.queue.shift();
    if (!line) {
      return;
    }
    const paragraph = dialogueParagraphs(SPEAKERS, TEXT, { lines: [line] })[0]!;
    this.art = [
      this.add.image(DIALOGUE_SCREEN.box.x, DIALOGUE_SCREEN.box.y, "ui-dialogue-box").setOrigin(0),
      ...drawDialogueParagraph(this, paragraph),
    ];
    this.remaining = BARK_DURATION_SECONDS * 1000;
  }
}
