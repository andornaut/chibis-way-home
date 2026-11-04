import { containsPoint } from "@andornaut/game-kit/rect";
import { type GameObjects, type Input, Scene } from "phaser";

import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { Point, Rect } from "../data/types";
import type { WholeRunDisplaySummary } from "../save/runSummary";
import type { RunStatsSummary, ZoneStatsSummary } from "../save/stats";
import { CUTSCENE_CONTINUE, focusKeyAction, STAGE_SUMMARY_BOUNDS, statsStatement } from "../ui";
import {
  addTextButton,
  captureTab,
  pressTextButton,
  PRIMARY_BUTTON,
  ringFocus,
  type TextButton,
} from "./cardParts";
import { modalInput, onScenePointer } from "./modalInput";
import { fitPlayCamera, playPoint } from "./playCamera";
import { addStageSummary } from "./runStatsParts";

export interface CutsceneData {
  readonly percent: number;
  readonly stage: string;
  readonly clearedStage: string;
  readonly cleared?: boolean;
  readonly runStats: RunStatsSummary;
  readonly zoneStats: ZoneStatsSummary;
  readonly wholeRun: WholeRunDisplaySummary;
}

// A required inter-stage screen. Only a fresh Continue activation starts the next stage.
export class CutsceneScene extends Scene {
  private stage!: string;
  private summary!: CutsceneData;
  private button!: TextButton;
  private focused = false;
  private finished = false;
  private statementHit: Rect | undefined;
  private ring: GameObjects.NineSlice | undefined;
  private press: { readonly id: number; readonly at: Point; cancelled: boolean } | undefined;

  constructor(key = "cutscene") {
    super(key);
  }
  init(data: CutsceneData): void {
    this.stage = data.stage;
    this.summary = data;
    this.focused = false;
    this.finished = false;
    this.statementHit = undefined;
    this.ring = undefined;
    this.press = undefined;
  }
  create(): void {
    fitPlayCamera(this);
    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x000000).setOrigin(0);
    const statement =
      this.summary.cleared === false
        ? undefined
        : statsStatement("clear", this.summary.clearedStage);
    const layout = addStageSummary(this, STAGE_SUMMARY_BOUNDS, {
      percent: this.summary.percent,
      runStats: this.summary.runStats,
      stage: this.summary.clearedStage,
      ...(statement && { statement }),
      wholeRun: this.summary.wholeRun,
      zoneStats: this.summary.zoneStats,
    });
    this.statementHit = layout.statement?.rect;
    this.button = addTextButton(this, CUTSCENE_CONTINUE, TEXT.map.continue, {
      style: PRIMARY_BUTTON,
    });
    captureTab(this, true);
    this.events.once("shutdown", () => captureTab(this, false));
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!modalInput(this).accepts(event)) {
        return;
      }
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
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.press || this.finished) {
        return;
      }
      const at = playPoint(this, pointer);
      if (this.continueContains(at)) {
        this.press = { at, cancelled: false, id: pointer.id };
        this.render();
      }
    });
    onScenePointer(this, "pointermove", (pointer: Input.Pointer) => {
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
        this.continueContains(at) &&
        Math.hypot(at.x - press.at.x, at.y - press.at.y) <= TOUCH.tapMaxDistance
      ) {
        this.continue();
      }
    };
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => up(pointer, false));
    onScenePointer(this, "pointerupoutside", (pointer: Input.Pointer) => up(pointer, true));
  }
  private continueContains(at: Point): boolean {
    return (
      containsPoint(CUTSCENE_CONTINUE.hit, at.x, at.y) ||
      (this.statementHit !== undefined && containsPoint(this.statementHit, at.x, at.y))
    );
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
    this.finish();
  }
  protected finish(): void {
    this.scene.start("zone", { continueVisit: true, node: this.stage });
  }
}
