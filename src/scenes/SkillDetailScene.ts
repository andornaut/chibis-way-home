import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { containsPoint } from "@andornaut/game-kit/rect";
import { type Input, Scene } from "phaser";

import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { Point, SkillId } from "../data/types";
import { PHONE_EVENTS } from "../pwa";
import { skillDetails } from "../ui";
import { drawActionHelp } from "./actionHelp";
import {
  addCardTextIn,
  addSlice,
  captureTab,
  cardFonts,
  paletteColour,
  ringFocus,
  TITLE_FONT,
} from "./cardParts";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput, onScenePointer } from "./modalInput";
import { catchModalTaps } from "./modalTaps";
import { fitPlayCamera, playPoint } from "./playCamera";
import { drawSkillButton } from "./skillButton";

export interface SkillDetailData {
  readonly onClose: () => void;
  readonly skill: SkillId;
}

export class SkillDetailScene extends Scene {
  private detail!: SkillDetailData;
  private closed = false;
  private visit = 0;
  private ready = false;
  private press: { readonly at: Point; readonly id: number; cancelled: boolean } | undefined;

  constructor() {
    super("skillDetail");
  }

  init(data: SkillDetailData): void {
    this.detail = data;
    this.visit++;
    this.closed = false;
    this.ready = false;
    this.press = undefined;
  }

  create(): void {
    const visit = this.visit;
    fitPlayCamera(this);
    const words = TEXT.skills[this.detail.skill];
    const layout = skillDetails(
      cardFonts(this),
      { ...SCREEN, x: 0, y: 0 },
      true,
      TEXT.buttons,
      words,
    );
    const close = layout.close!;
    addSlice(this, "ui-settings-card", layout.card);
    addCardTextIn(this, TITLE_FONT, layout.title!, words.title, paletteColour(this, "ink"));
    drawActionHelp(
      this,
      paletteColour(this, "ink"),
      layout.groups.description!,
      TEXT.buttons,
      layout.description,
    );
    drawSkillButton(this, layout.groups.icon!, this.detail.skill).ready(true);
    const closeX = this.add.sprite(close.at.x, close.at.y, "ui-close").setOrigin(0);
    let focus = false;
    let ring: ReturnType<typeof ringFocus>;
    const render = () => {
      ring = ringFocus(this, ring, focus ? close.art : undefined);
      return closeX.play(
        animationKey("ui-close", this.press && !this.press.cancelled ? "pressed" : "normal"),
      );
    };
    render();
    modalInput(this).subscribe(() => {
      this.press = undefined;
      render();
    });
    catchModalTaps(this, this.cameras.main, {
      close: () => this.close(),
      covered: () => [layout.card, close.hit],
    });
    captureTab(this, true);
    const back = (event: Event) => {
      if (modalInput(this).accepts(event)) {
        event.stopImmediatePropagation();
        this.close();
      }
    };
    window.addEventListener(PHONE_EVENTS.backPressed, back, true);
    this.events.once("shutdown", () => {
      this.ready = false;
      this.press = undefined;
      captureTab(this, false);
      window.removeEventListener(PHONE_EVENTS.backPressed, back, true);
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!modalInput(this).accepts(event) || event.repeat) {
        return;
      }
      event.stopPropagation();
      if (["Escape", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        this.close();
      } else if (event.key === "Tab" || event.key.startsWith("Arrow")) {
        event.preventDefault();
        focus = true;
        render();
      }
    });
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      const at = playPoint(this, pointer);
      if (this.ready && !this.press && containsPoint(close.hit, at.x, at.y)) {
        this.input.stopPropagation();
        this.press = { at, cancelled: false, id: pointer.id };
        render();
      }
    });
    onScenePointer(this, "pointermove", (pointer: Input.Pointer) => {
      if (this.press?.id === pointer.id) {
        const at = playPoint(this, pointer);
        this.press.cancelled ||=
          Math.hypot(at.x - this.press.at.x, at.y - this.press.at.y) > TOUCH.tapMaxDistance;
        render();
      }
    });
    const up = (pointer: Input.Pointer, outside: boolean) => {
      if (this.press?.id !== pointer.id) {
        return;
      }
      const press = this.press;
      this.press = undefined;
      render();
      const at = playPoint(this, pointer);
      if (
        !outside &&
        !pointer.wasCanceled &&
        !press.cancelled &&
        Math.hypot(at.x - press.at.x, at.y - press.at.y) <= TOUCH.tapMaxDistance &&
        containsPoint(close.hit, at.x, at.y)
      ) {
        this.close();
      }
    };
    onScenePointer(this, "pointerup", (pointer) => up(pointer, false));
    onScenePointer(this, "pointerupoutside", (pointer) => up(pointer, true));
    const backdrop = showModalBackdrop(this);
    void backdrop.ready.then(() => this.backdropReady(visit));
  }

  private backdropReady(visit: number): void {
    if (this.visit === visit) {
      this.ready = !this.closed && this.sys.isActive();
    }
  }

  private close(): void {
    if (!this.ready || this.closed) {
      return;
    }
    this.closed = true;
    modalInput(this).close();
    this.scene.stop();
    this.detail.onClose();
  }
}
