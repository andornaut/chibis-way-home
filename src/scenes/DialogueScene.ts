import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import {
  phaserBitmapFont,
  type PhaserFontData,
} from "@andornaut/game-kit/text/phaser/phaserBitmapFont";
import { type GameObjects, type Input, Scene } from "phaser";

import { DIALOGUES, SPEAKERS } from "../data/dialogues";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { DialogueChoice } from "../data/types";
import {
  departureDialogueButtons,
  DIALOGUE_SCREEN,
  type DialogueAction,
  dialogueButtons,
  type DialogueControl,
  dialogueKeyAction,
  type DialogueParagraph,
  dialogueParagraphs,
  type DialoguePress,
  dialogueProgress,
  dialogueTapAction,
  type LabelledButton,
  moveDialoguePress,
  type PressArea,
  pressedArea,
  stepFocus,
} from "../ui";
import {
  addTextButton,
  BODY_FONT,
  captureTab,
  cardFonts,
  pressTextButton,
  PRIMARY_BUTTON,
  ringFocus,
  type TextButton,
} from "./cardParts";
import type { DialogueChoiceData } from "./DialogueChoiceScene";
import { drawDialoguePanel } from "./dialoguePanel";
import { dialogueParagraphPressAreas, drawDialogueParagraph } from "./dialogueParagraph";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput, onScenePointer } from "./modalInput";
import { fitPlayCamera, playPoint } from "./playCamera";

export interface DialogueData {
  readonly scene: string;
  readonly linear?: boolean;
  readonly opener?: string;
}

export interface DialogueOpener {
  dialogueClosed(selection?: string): void;
}

export interface DialogueChoiceOpener {
  choiceSelected(selection: string): void;
}

const CONTROLS: readonly DialogueControl[] = ["continue", "skip"];

// ZoneScene owns the frozen world and per-attempt trigger. This scene owns one paragraph at a
// time, consuming input until the conversation and its optional required terminal choice finish.
export class DialogueScene extends Scene implements DialogueChoiceOpener {
  private paragraphs: readonly DialogueParagraph[] = [];
  private opener = "zone";
  private paragraph = 0;
  private paragraphArt: GameObjects.GameObject[] = [];
  // The showing paragraph's panel press areas: the panel and its name tab.
  private panelAreas: readonly PressArea<DialogueControl>[] = [];
  private choice: DialogueChoice | undefined;
  private choosing = false;
  private finished = false;
  private press: DialoguePress | undefined;
  private focus: DialogueControl | undefined;
  private focusRing: GameObjects.NineSlice | undefined;
  private layouts!: Readonly<Record<DialogueControl, LabelledButton>>;
  private buttons!: Readonly<Record<DialogueControl, TextButton>>;
  private footer!: GameObjects.Container;

  constructor(
    key = "dialogue",
    private readonly departure = false,
  ) {
    super(key);
  }

  init({ linear = false, opener = "zone", scene }: DialogueData): void {
    this.opener = opener;
    const plan = DIALOGUES[scene];
    if (!plan) {
      throw new Error(`No dialogue ${scene}`);
    }
    if ((this.departure || linear) && plan.choice) {
      throw new Error("Zone exchanges must remain skippable linear conversations");
    }
    this.paragraphs = dialogueParagraphs(SPEAKERS, TEXT, plan);
    this.choice = plan.choice;
    this.paragraph = 0;
    this.paragraphArt = [];
    this.panelAreas = [];
    this.choosing = false;
    this.finished = false;
    this.press = undefined;
    this.focus = undefined;
    this.focusRing = undefined;
  }

  create(): void {
    fitPlayCamera(this);
    if (this.departure) {
      this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x000000).setOrigin(0);
    }
    drawDialoguePanel(this);
    this.drawFooter();
    this.drawParagraph();
    this.watchInput();
    modalInput(this).subscribe(() => {
      this.press = undefined;
      this.renderFooter();
    });
    captureTab(this, true);
    this.events.once("shutdown", () => captureTab(this, false));
    if (!this.departure) {
      showModalBackdrop(this);
    }
  }

  // The required choice calls once after its own scene stops; the world remains frozen until here.
  choiceSelected(selection: string): void {
    if (this.choosing) {
      this.finish(selection);
    }
  }

  private bodyFont() {
    return phaserBitmapFont(this.cache.bitmapFont.get(BODY_FONT).data as PhaserFontData);
  }

  private drawFooter(): void {
    const words = TEXT.dialogue;
    if (!words.continue.trim() || !words.skip.trim()) {
      throw new Error("Dialogue actions need labels");
    }
    const font = cardFonts(this).title;
    const width = (label: string) => inkWidth(font, DIALOGUE_SCREEN.text.scale, label);
    this.layouts = (this.departure ? departureDialogueButtons : dialogueButtons)({
      continue: width(words.continue),
      skip: width(words.skip),
    });
    this.buttons = {
      continue: addTextButton(this, this.layouts.continue, words.continue, {
        style: PRIMARY_BUTTON,
      }),
      skip: addTextButton(this, this.layouts.skip, words.skip),
    };
    this.footer = this.add.container();
    for (const name of CONTROLS) {
      const { faces, label } = this.buttons[name];
      this.footer.add([faces.normal, faces.pressed, label.label]);
    }
    this.renderFooter();
  }

  private renderFooter(): void {
    for (const name of CONTROLS) {
      pressTextButton(this.buttons[name], this.press?.control === name && !this.press.cancelled);
    }
    this.focusRing = ringFocus(
      this,
      this.focusRing,
      this.focus === undefined ? undefined : this.layouts[this.focus].button,
    );
  }

  private drawParagraph(): void {
    this.paragraphArt.forEach((object) => object.destroy());
    const paragraph = this.paragraphs[this.paragraph];
    if (!paragraph) {
      throw new Error("Missing dialogue paragraph");
    }
    this.paragraphArt = drawDialogueParagraph(this, paragraph);
    this.panelAreas = dialogueParagraphPressAreas(this, paragraph);
  }

  private finish(selection?: string): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.scene.stop();
    (this.scene.get(this.opener) as unknown as DialogueOpener).dialogueClosed(selection);
  }

  private act(action: DialogueAction | undefined): void {
    if (this.finished || this.choosing || action === undefined) {
      return;
    }
    if (action === "nextFocus" || action === "previousFocus") {
      this.focus = stepFocus(CONTROLS, this.focus, action === "nextFocus" ? "next" : "previous");
      this.renderFooter();
    } else {
      const next = dialogueProgress(this.choice, this.paragraphs.length, this.paragraph, action);
      if (next.kind === "complete") {
        this.finish();
      } else if (next.kind === "choice") {
        this.choosing = true;
        this.press = undefined;
        this.focusRing?.destroy();
        this.focusRing = undefined;
        this.footer.setVisible(false);
        this.scene.launch("dialogueChoice", { choice: next.choice } satisfies DialogueChoiceData);
        this.scene.pause();
      } else {
        this.paragraph = next.index;
        this.drawParagraph();
      }
    }
  }

  private pressAreas(): readonly PressArea<DialogueControl>[] {
    return [
      ...CONTROLS.map((key) => ({
        art: this.layouts[key].button,
        hit: this.layouts[key].hit,
        key,
      })),
      ...this.panelAreas,
    ];
  }

  private watchInput(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!modalInput(this).accepts(event)) {
        return;
      }
      event.stopPropagation();
      this.act(dialogueKeyAction(this.focus, event));
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => {
      event.stopPropagation();
    });
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.press !== undefined || this.finished || this.choosing) {
        return;
      }
      const at = playPoint(this, pointer);
      this.press = {
        at,
        cancelled: false,
        control: pressedArea(this.pressAreas(), at),
        id: pointer.id,
      };
      this.focus = this.press.control;
      this.renderFooter();
    });
    onScenePointer(this, "pointermove", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.press?.id === pointer.id) {
        this.press = moveDialoguePress(TOUCH.tapMaxDistance, playPoint(this, pointer), this.press);
        this.renderFooter();
      }
    });
    const up = (pointer: Input.Pointer, outside: boolean) => {
      this.input.stopPropagation();
      const action = outside
        ? undefined
        : dialogueTapAction(this.pressAreas(), TOUCH.tapMaxDistance, this.press, {
            ...playPoint(this, pointer),
            id: pointer.id,
            wasCanceled: pointer.wasCanceled,
          });
      if (this.press?.id === pointer.id) {
        this.press = undefined;
        this.renderFooter();
      }
      this.act(action);
    };
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => up(pointer, false));
    onScenePointer(this, "pointerupoutside", (pointer: Input.Pointer) => up(pointer, true));
  }
}
