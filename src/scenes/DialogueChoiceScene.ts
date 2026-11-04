import { type GameObjects, type Input, Scene } from "phaser";

import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { DialogueChoice } from "../data/types";
import {
  dialogueChoice,
  dialogueChoiceKey,
  dialogueChoiceLayout,
  type PressArea,
  pressedArea,
  type ResolvedDialogueChoice,
} from "../ui";
import {
  addCardTextIn,
  addSlice,
  addTextButton,
  BODY_FONT,
  captureTab,
  cardFonts,
  paletteColour,
  pressTextButton,
  ringFocus,
  type TextButton,
} from "./cardParts";
import type { DialogueChoiceOpener } from "./DialogueScene";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput, onScenePointer } from "./modalInput";
import { catchModalTaps } from "./modalTaps";
import { fitPlayCamera, playPoint } from "./playCamera";

export interface DialogueChoiceData {
  readonly choice: DialogueChoice;
}

// A required terminal choice. No default, Skip, close, back or outside-tap dismissal is provided.
export class DialogueChoiceScene extends Scene {
  private choice!: ResolvedDialogueChoice;
  private layouts!: ReturnType<typeof dialogueChoiceLayout>;
  private buttons = new Map<string, TextButton>();
  private focus: string | undefined;
  private focusRing: GameObjects.NineSlice | undefined;
  private press:
    | {
        readonly at: { readonly x: number; readonly y: number };
        readonly id: number;
        readonly target: string | undefined;
        cancelled: boolean;
      }
    | undefined;
  private finished = false;

  constructor() {
    super("dialogueChoice");
  }

  init({ choice }: DialogueChoiceData): void {
    this.choice = dialogueChoice(TEXT.lines, choice);
    this.buttons = new Map();
    this.focus = undefined;
    this.focusRing = undefined;
    this.press = undefined;
    this.finished = false;
  }

  create(): void {
    fitPlayCamera(this);
    this.layouts = dialogueChoiceLayout(cardFonts(this), this.choice.prompt, this.choice.options);
    addSlice(this, "ui-settings-card", this.layouts.card);
    addCardTextIn(
      this,
      BODY_FONT,
      this.layouts.question,
      this.layouts.text,
      paletteColour(this, "ink"),
    );
    for (const { id, layout } of this.layouts.buttons) {
      const label = this.choice.options.find((option) => option.id === id)!.label;
      this.buttons.set(id, addTextButton(this, layout, label));
    }
    this.render();
    catchModalTaps(this, this.cameras.main, {
      covered: () => [this.layouts.card, ...this.layouts.buttons.map(({ layout }) => layout.hit)],
    });
    this.watchInput();
    modalInput(this).subscribe(() => {
      this.press = undefined;
      this.render();
    });
    captureTab(this, true);
    this.events.once("shutdown", () => captureTab(this, false));
    showModalBackdrop(this);
  }

  private render(): void {
    for (const [id, button] of this.buttons) {
      pressTextButton(button, this.press?.target === id && !this.press.cancelled);
    }
    const focused = this.layouts.buttons.find(({ id }) => id === this.focus)?.layout.button;
    this.focusRing = ringFocus(this, this.focusRing, focused);
  }

  private areas(): readonly PressArea<string>[] {
    return this.layouts.buttons.map(({ id, layout }) => ({
      art: layout.button,
      hit: layout.hit,
      key: id,
    }));
  }

  private select(id: string): void {
    if (this.finished || !this.buttons.has(id)) {
      return;
    }
    this.finished = true;
    this.scene.stop();
    (this.scene.get("dialogue") as unknown as DialogueChoiceOpener).choiceSelected(id);
  }

  private watchInput(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!modalInput(this).accepts(event)) {
        return;
      }
      event.stopPropagation();
      const result = dialogueChoiceKey([...this.buttons.keys()], this.focus, event);
      this.focus = result.focus;
      this.render();
      if (result.selection !== undefined) {
        this.select(result.selection);
      }
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => event.stopPropagation());
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.press !== undefined || this.finished) {
        return;
      }
      const at = playPoint(this, pointer);
      this.press = { at, cancelled: false, id: pointer.id, target: pressedArea(this.areas(), at) };
      this.render();
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
        press.target !== undefined &&
        Math.hypot(at.x - press.at.x, at.y - press.at.y) <= TOUCH.tapMaxDistance &&
        pressedArea(this.areas(), at) === press.target
      ) {
        this.select(press.target);
      }
    };
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => up(pointer, false));
    onScenePointer(this, "pointerupoutside", (pointer: Input.Pointer) => up(pointer, true));
  }
}
