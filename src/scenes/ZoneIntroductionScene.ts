import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { type GameObjects, Scene } from "phaser";

import { CHARACTERS } from "../data/characters";
import { TILE } from "../data/screen";
import type { Point, ZoneEntryIntroduction } from "../data/types";
import type { DialogueData, DialogueOpener } from "./DialogueScene";
import { modalInput } from "./modalInput";
import { fitPlayCamera } from "./playCamera";

export interface ZoneIntroductionData {
  readonly entry: ZoneEntryIntroduction;
  readonly feet: Point;
  readonly scene: string;
}

export interface IntroductionOpener {
  introductionClosed(): void;
  introductionHeard(): void;
}

// Cinematic art has no rules object, contact body, attack state or encounter quota.
export class ZoneIntroductionScene extends Scene implements DialogueOpener {
  private introduction!: ZoneIntroductionData;
  private actor: GameObjects.Sprite | undefined;
  private phase: "approach" | "dialogue" | "escape" | "finished" = "finished";

  constructor() {
    super("zoneIntroduction");
  }

  init(data: ZoneIntroductionData): void {
    this.introduction = data;
    this.actor = undefined;
    this.phase = "approach";
  }

  create(): void {
    fitPlayCamera(this);
    const { entry, feet } = this.introduction;
    const character = CHARACTERS[entry.character];
    if (
      !character ||
      entry.escapeTilesPerSecond <= 0 ||
      !Number.isFinite(entry.escapeTilesPerSecond)
    ) {
      throw new Error(`Invalid entry introduction profile ${entry.character}`);
    }
    for (const tag of [entry.idleAnimation, entry.runAnimation]) {
      if (!this.anims.exists(animationKey(character.art, tag))) {
        throw new Error(`Missing introduction animation ${character.art}:${tag}`);
      }
    }
    modalInput(this).open();
    this.actor = this.add
      .sprite(this.cameras.main.width, feet.y, character.art)
      .setOrigin(0.5, 1)
      .setFlipX(true)
      .play(animationKey(character.art, entry.runAnimation));
    this.actor.x += this.actor.displayWidth / 2;
    this.events.once("shutdown", () => {
      if (this.phase === "dialogue") {
        this.scene.stop("dialogue");
      }
      this.phase = "finished";
      this.actor?.destroy();
      this.actor = undefined;
    });
  }

  private openDialogue(): void {
    this.phase = "dialogue";
    const { entry } = this.introduction;
    const character = CHARACTERS[entry.character]!;
    this.actor!.play(animationKey(character.art, entry.idleAnimation));
    this.scene.launch("dialogue", {
      linear: true,
      opener: this.scene.key,
      scene: this.introduction.scene,
    } satisfies DialogueData);
  }

  dialogueClosed(): void {
    if (this.phase !== "dialogue" || !this.actor) {
      return;
    }
    this.phase = "escape";
    (this.scene.get("zone") as unknown as IntroductionOpener).introductionHeard();
    const { entry } = this.introduction;
    const character = CHARACTERS[entry.character]!;
    this.actor.setFlipX(false).play(animationKey(character.art, entry.runAnimation));
  }

  override update(_time: number, delta: number): void {
    if ((this.phase !== "approach" && this.phase !== "escape") || !this.actor) {
      return;
    }
    const distance = (this.introduction.entry.escapeTilesPerSecond * TILE * delta) / 1000;
    const width = this.cameras.main.width;
    if (this.phase === "approach") {
      this.actor.x = Math.max(width / 2, this.actor.x - distance);
      if (this.actor.x === width / 2) {
        this.openDialogue();
      }
      return;
    }
    this.actor.x += distance;
    if (this.actor.x - this.actor.displayWidth / 2 <= width) {
      return;
    }
    this.phase = "finished";
    this.actor.destroy();
    this.actor = undefined;
    this.scene.stop();
    (this.scene.get("zone") as unknown as IntroductionOpener).introductionClosed();
  }
}
