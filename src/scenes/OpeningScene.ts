import { type GameObjects, type Input, Scene } from "phaser";

import { OPENING } from "../data/opening";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { Point } from "../data/types";
import { createOpeningPlayback } from "../progress";
import { focusKeyAction, openingLayout, pressedArea, stepFocus } from "../ui";
import {
  addCardText,
  addTextButton,
  BODY_FONT,
  captureTab,
  cardFonts,
  paletteColour,
  pressTextButton,
  PRIMARY_BUTTON,
  ringFocus,
  type TextButton,
} from "./cardParts";
import { modalInput, onScenePointer } from "./modalInput";
import { renderOpeningLayer } from "./openingLayer";
import { fitPlayCamera, playPoint } from "./playCamera";
import { saveOpeningSeen } from "./save";

type Action = "continue" | "skip";

export class OpeningScene extends Scene {
  private playback!: ReturnType<typeof createOpeningPlayback>;
  private art!: GameObjects.Container;
  private background: GameObjects.Image | undefined;
  private layers: GameObjects.Sprite[] = [];
  private caption!: GameObjects.BitmapText;
  private buttons!: Record<Action, TextButton>;
  private layout!: ReturnType<typeof openingLayout>;
  private focus: Action | undefined;
  private ring: GameObjects.NineSlice | undefined;
  private shot: object | undefined;
  private beat: object | undefined;
  private press:
    | { readonly action: Action; readonly at: Point; readonly id: number; cancelled: boolean }
    | undefined;

  constructor() {
    super("opening");
  }

  create(): void {
    fitPlayCamera(this);
    this.focus = undefined;
    this.ring = undefined;
    this.press = undefined;
    this.shot = undefined;
    this.beat = undefined;
    this.layers = [];
    this.playback = createOpeningPlayback(() => {
      saveOpeningSeen();
      this.scene.start("map");
    }, OPENING);
    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, paletteColour(this, "ink")).setOrigin(0);
    this.art = this.add.container(0, 0);
    this.background = undefined;
    const footerY = openingLayout(
      cardFonts(this),
      TEXT.dialogue,
      TEXT.lines[OPENING[0]!.text]!,
    ).footerY;
    this.add
      .rectangle(0, footerY, SCREEN.width, SCREEN.height - footerY, paletteColour(this, "ink"))
      .setOrigin(0);
    this.caption = addCardText(this, BODY_FONT, { x: 0, y: 0 }, "", paletteColour(this, "white"));
    this.layout = openingLayout(cardFonts(this), TEXT.dialogue, TEXT.lines[OPENING[0]!.text]!);
    this.buttons = {
      continue: addTextButton(this, this.layout.continue, TEXT.dialogue.continue, {
        marked: true,
        style: PRIMARY_BUTTON,
      }),
      skip: addTextButton(this, this.layout.skip, TEXT.dialogue.skip),
    };
    const input = modalInput(this);
    input.open();
    input.subscribe(() => {
      this.press = undefined;
      this.renderControls();
    });
    captureTab(this, true);
    this.events.once("shutdown", () => captureTab(this, false));
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!input.accepts(event)) {
        return;
      }
      event.stopPropagation();
      const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
      if (action === "next" || action === "previous") {
        event.preventDefault();
        this.focus = stepFocus(["skip", "continue"] as const, this.focus, action);
        this.renderControls();
      } else if (action === "press") {
        event.preventDefault();
        this.activate(this.focus ?? "continue");
      }
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => event.stopPropagation());
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.press) {
        return;
      }
      const at = playPoint(this, pointer);
      const action = this.actionAt(at);
      if (action) {
        this.press = { action, at, cancelled: false, id: pointer.id };
      }
      this.renderControls();
    });
    onScenePointer(this, "pointermove", (pointer: Input.Pointer) => {
      if (this.press?.id !== pointer.id) {
        return;
      }
      const at = playPoint(this, pointer);
      this.press.cancelled ||=
        Math.hypot(at.x - this.press.at.x, at.y - this.press.at.y) > TOUCH.tapMaxDistance;
      this.renderControls();
    });
    const up = (pointer: Input.Pointer, outside: boolean) => {
      if (this.press?.id !== pointer.id) {
        return;
      }
      const press = this.press;
      this.press = undefined;
      const at = playPoint(this, pointer);
      if (
        !outside &&
        !pointer.wasCanceled &&
        !press.cancelled &&
        this.actionAt(at) === press.action &&
        Math.hypot(at.x - press.at.x, at.y - press.at.y) <= TOUCH.tapMaxDistance
      ) {
        this.activate(press.action);
      }
      this.renderControls();
    };
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => up(pointer, false));
    onScenePointer(this, "pointerupoutside", (pointer: Input.Pointer) => up(pointer, true));
    this.drawFrame();
    this.renderControls();
  }

  override update(_time: number, delta: number): void {
    if (modalInput(this).accepts()) {
      this.playback.tick(delta / 1000);
    }
    this.drawFrame();
  }

  private actionAt(at: Point): Action | undefined {
    return pressedArea(
      (["skip", "continue"] as const).map((key) => ({
        art: this.layout[key].button,
        hit: this.layout[key].hit,
        key,
      })),
      at,
    );
  }

  private activate(action: Action): void {
    if (!modalInput(this).accepts() || this.playback.frame().finished) {
      return;
    }
    modalInput(this).invalidate();
    this.press = undefined;
    if (action === "skip") {
      this.playback.skip();
    } else {
      this.playback.advance();
    }
    if (!this.playback.frame().finished) {
      this.drawFrame();
    }
  }

  private renderControls(): void {
    if (this.playback.frame().finished) {
      return;
    }
    for (const action of ["skip", "continue"] as const) {
      pressTextButton(this.buttons[action], this.press?.action === action && !this.press.cancelled);
    }
    this.ring = ringFocus(this, this.ring, this.focus ? this.layout[this.focus].button : undefined);
  }

  private drawFrame(): void {
    const frame = this.playback.frame();
    if (this.shot !== frame.shot) {
      this.layers.forEach((sprite) => sprite.destroy());
      this.background?.destroy();
      this.background = undefined;
      if (frame.shot.background !== null) {
        this.background = this.add.image(0, 0, frame.shot.background).setOrigin(0);
        this.art.add(this.background);
      }
      this.layers = frame.shot.layers.map((layer) => {
        const sprite = this.add.sprite(0, 0, layer.art);
        this.art.add(sprite);
        return sprite;
      });
      this.shot = frame.shot;
    }
    frame.layers.forEach(({ layer, pose }, index) =>
      renderOpeningLayer(layer, pose, this.layers[index]!),
    );
    if (this.beat !== frame.beat) {
      const text = TEXT.lines[frame.beat.text];
      if (text === undefined) {
        throw new Error(`Missing opening caption ${frame.beat.text}`);
      }
      this.layout = openingLayout(cardFonts(this), TEXT.dialogue, text);
      this.caption.setText(text).setPosition(this.layout.caption.x, this.layout.caption.y);
      this.beat = frame.beat;
    }
  }
}
