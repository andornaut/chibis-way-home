import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
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
import type { DialogueChoice, Point } from "../data/types";
import {
  type DialogueAction,
  type DialogueControl,
  dialogueKeyAction,
  dialogueLines,
  type DialogueParagraph,
  dialogueParagraphs,
  type DialoguePress,
  dialogueProgress,
  dialogueTapAction,
  liveDialogueKeyAction,
  moveDialoguePress,
} from "../dialogue/conversation";
import {
  departureDialogueButtons,
  DIALOGUE_SCREEN,
  dialogueButtons,
  dialogueNameTab,
  dialogueSpeakerLayout,
  liveDialogueContains,
} from "../layout/dialogueScreen";
import { type PressArea, pressedArea } from "../layout/hitAreas";
import type { LabelledButton } from "../layout/restartCard";
import { stepFocus } from "../pause/focusInput";
import {
  addCardText,
  addSlice,
  addTextButton,
  BODY_FONT,
  captureTab,
  paletteColour,
  pressTextButton,
  PRIMARY_BUTTON,
  ringFocus,
  type TextButton,
  TITLE_FONT,
} from "./cardParts";
import type { DialogueChoiceData } from "./DialogueChoiceScene";
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

export interface ForeshadowOpener {
  foreshadowClosed(): void;
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
    private readonly live = false,
  ) {
    super(key);
  }

  init({ linear = false, opener = "zone", scene }: DialogueData): void {
    this.opener = opener;
    const plan = DIALOGUES[scene];
    if (!plan) {
      throw new Error(`No dialogue ${scene}`);
    }
    if ((this.live || this.departure || linear) && plan.choice) {
      throw new Error("Zone exchanges must remain skippable linear conversations");
    }
    this.paragraphs = dialogueParagraphs(SPEAKERS, TEXT, plan);
    this.choice = plan.choice;
    this.paragraph = 0;
    this.paragraphArt = [];
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
    this.add.image(DIALOGUE_SCREEN.box.x, DIALOGUE_SCREEN.box.y, "ui-dialogue-box").setOrigin(0);
    this.drawFooter();
    this.drawParagraph();
    this.watchInput();
    modalInput(this).subscribe(() => {
      this.press = undefined;
      this.renderFooter();
    });
    if (this.live) {
      this.events.on("pause", () => {
        this.press = undefined;
        this.renderFooter();
      });
      this.events.on("resume", () => {
        this.press = undefined;
        captureTab(this, true);
        this.renderFooter();
      });
    }
    captureTab(this, true);
    this.events.once("shutdown", () => captureTab(this, false));
    if (!this.live && !this.departure) {
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
    const width = (label: string) => inkWidth(this.bodyFont(), DIALOGUE_SCREEN.text.scale, label);
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
    if (!paragraph || (paragraph.portrait !== null && !this.textures.exists(paragraph.portrait))) {
      throw new Error(`Missing dialogue portrait ${paragraph?.portrait ?? ""}`);
    }
    const layout = dialogueSpeakerLayout(paragraph.side);
    const text = DIALOGUE_SCREEN.text;
    const nameFont = phaserBitmapFont(this.cache.bitmapFont.get(TITLE_FONT).data as PhaserFontData);
    const tab = dialogueNameTab(paragraph.side, inkWidth(nameFont, text.scale, paragraph.name));
    if (tab.x + tab.width > layout.textX + text.width) {
      throw new Error(`Dialogue speaker name does not fit: ${paragraph.name}`);
    }
    const frame = sheetTags(this.cache.json.get("ui-name-tab") as AsepriteSheet).get(
      paragraph.colour,
    )?.[0]?.frame;
    if (frame === undefined) {
      throw new Error(`Missing dialogue name-tab colour ${paragraph.colour}`);
    }
    this.paragraphArt = [
      this.add
        .image(layout.portraitFrame.x, layout.portraitFrame.y, "ui-portrait-frame")
        .setOrigin(0),
      paragraph.portrait === null
        ? this.add
            .rectangle(layout.portrait.x, layout.portrait.y, 64, 64, paletteColour(this, "dslate"))
            .setOrigin(0)
        : this.add.image(layout.portrait.x, layout.portrait.y, paragraph.portrait).setOrigin(0),
      addSlice(this, "ui-name-tab", tab, frame),
      addCardText(this, TITLE_FONT, layout.name, paragraph.name, paletteColour(this, "ink")),
      ...dialogueLines(this.bodyFont(), text, text.width, paragraph.text).map((line, index) =>
        addCardText(
          this,
          BODY_FONT,
          { x: layout.textX, y: text.y + index * text.pitch },
          line,
          paletteColour(this, "cream"),
        ),
      ),
    ];
  }

  private finish(selection?: string): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.scene.stop();
    if (this.live) {
      (this.scene.get("zone") as unknown as ForeshadowOpener).foreshadowClosed();
    } else {
      (this.scene.get(this.opener) as unknown as DialogueOpener).dialogueClosed(selection);
    }
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
    return CONTROLS.map((key) => ({
      art: this.layouts[key].button,
      hit: this.layouts[key].hit,
      key,
    }));
  }

  blocksPoint(point: Point): boolean {
    return liveDialogueContains(this.layouts ? this.pressAreas() : [], point);
  }

  private watchInput(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!modalInput(this).accepts(event)) {
        return;
      }
      if (this.live && !["Tab", "Enter"].includes(event.key)) {
        return;
      }
      if (this.live) {
        event.preventDefault();
      }
      event.stopPropagation();
      this.act((this.live ? liveDialogueKeyAction : dialogueKeyAction)(this.focus, event));
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => {
      if (!this.live || ["Tab", "Enter"].includes(event.key)) {
        event.stopPropagation();
      }
    });
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      if (this.live && !this.blocksPoint(playPoint(this, pointer))) {
        return;
      }
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
      if (this.live && this.press?.id !== pointer.id) {
        return;
      }
      this.input.stopPropagation();
      if (this.press?.id === pointer.id) {
        this.press = moveDialoguePress(TOUCH.tapMaxDistance, playPoint(this, pointer), this.press);
        this.renderFooter();
      }
    });
    const up = (pointer: Input.Pointer, outside: boolean) => {
      if (this.live && this.press?.id !== pointer.id) {
        return;
      }
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
