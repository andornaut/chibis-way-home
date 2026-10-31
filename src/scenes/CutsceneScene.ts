import { containsPoint } from "@andornaut/game-kit/rect";
import { type GameObjects, type Input, Scene } from "phaser";

import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { Point } from "../data/types";
import { CARD_CONTENT } from "../layout/contentCard";
import { CUTSCENE_CONTINUE } from "../layout/cutscene";
import { focusKeyAction } from "../pause/focusInput";
import type { RunStatsSummary } from "../save/stats";
import {
  addTextButton,
  captureTab,
  pressTextButton,
  PRIMARY_BUTTON,
  ringFocus,
  type TextButton,
} from "./cardParts";
import { fitPlayCamera, playPoint } from "./playCamera";
import { addStageSummary } from "./runStatsParts";

export interface CutsceneData {
  readonly stage: string;
  readonly clearedStage: string;
  readonly runStats: RunStatsSummary;
}

// A required inter-stage screen. Only a fresh Continue activation starts the next stage.
export class CutsceneScene extends Scene {
  private stage!: string;
  private summary!: CutsceneData;
  private button!: TextButton;
  private focused = false;
  private finished = false;
  private ring: GameObjects.NineSlice | undefined;
  private press: { readonly id: number; readonly at: Point; cancelled: boolean } | undefined;

  constructor() {
    super("cutscene");
  }
  init(data: CutsceneData): void {
    this.stage = data.stage;
    this.summary = data;
    this.focused = false;
    this.finished = false;
    this.ring = undefined;
    this.press = undefined;
  }
  create(): void {
    fitPlayCamera(this);
    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x000000).setOrigin(0);
    addStageSummary(
      this,
      {
        height: CUTSCENE_CONTINUE.hit.y - CARD_CONTENT.gap - CARD_CONTENT.padding,
        width: SCREEN.width - 2 * CARD_CONTENT.padding,
        x: CARD_CONTENT.padding,
        y: CARD_CONTENT.padding,
      },
      { runStats: this.summary.runStats, stage: this.summary.clearedStage },
    );
    this.button = addTextButton(this, CUTSCENE_CONTINUE, TEXT.map.continue, {
      style: PRIMARY_BUTTON,
    });
    captureTab(this, true);
    this.events.once("shutdown", () => captureTab(this, false));
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      event.stopPropagation();
      const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
      if (action === "next" || action === "previous") {
        this.focused = true;
        this.render();
      } else if (action === "press") {
        this.continue();
      }
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => event.stopPropagation());
    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.press || this.finished) {
        return;
      }
      const at = playPoint(this, pointer);
      if (containsPoint(CUTSCENE_CONTINUE.hit, at.x, at.y)) {
        this.press = { at, cancelled: false, id: pointer.id };
        this.render();
      }
    });
    this.input.on("pointermove", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.press?.id === pointer.id) {
        const at = playPoint(this, pointer);
        this.press.cancelled ||=
          Math.hypot(at.x - this.press.at.x, at.y - this.press.at.y) > TOUCH.tapMaxDistance;
        this.render();
      }
    });
    const up = (pointer: Input.Pointer, outside: boolean) => {
      this.input.stopPropagation();
      if (this.press?.id !== pointer.id) {
        return;
      }
      const press = this.press;
      this.press = undefined;
      this.render();
      const at = playPoint(this, pointer);
      if (
        !outside &&
        !pointer.wasCanceled &&
        !press.cancelled &&
        containsPoint(CUTSCENE_CONTINUE.hit, at.x, at.y) &&
        Math.hypot(at.x - press.at.x, at.y - press.at.y) <= TOUCH.tapMaxDistance
      ) {
        this.continue();
      }
    };
    this.input.on("pointerup", (pointer: Input.Pointer) => up(pointer, false));
    this.input.on("pointerupoutside", (pointer: Input.Pointer) => up(pointer, true));
  }
  private render(): void {
    pressTextButton(this.button, this.press !== undefined && !this.press.cancelled);
    this.ring = ringFocus(this, this.ring, this.focused ? CUTSCENE_CONTINUE.button : undefined);
  }
  private continue(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.press = undefined;
    this.scene.start("zone", { continueVisit: true, node: this.stage });
  }
}
