import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { type GameObjects, type Input, Scene } from "phaser";

import { OPENING } from "../data/opening.ts";
import { SCREEN } from "../data/screen.ts";
import { TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import type { Point } from "../data/types/index.ts";
import { createOpeningPlayback } from "../progress/index.ts";
import {
  createOpeningView,
  focusKeyAction,
  openingLayout,
  type OpeningView,
  pressedArea,
  showOpeningCaption,
  stepFocus,
} from "../ui/index.ts";
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
} from "./cardParts.ts";
import { followTaps } from "./domTaps.ts";
import { artFrameUrl, mountSceneView, revealSceneView, sceneDomUi } from "./domUi.ts";
import { modalInput, onScenePointer } from "./modalInput.ts";
import { renderOpeningLayer } from "./openingLayer.ts";
import { fitPlayCamera, playPoint } from "./playCamera.ts";
import { saveOpeningSeen } from "./save.ts";

type Action = "continue" | "skip";
// The keyboard's focus order: Continue then Skip, though Skip is drawn on the left.
const ACTIONS: readonly Action[] = ["continue", "skip"];

export class OpeningScene extends Scene {
  private view: OpeningView | undefined;
  private htmlReady = false;
  private generation = 0;
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
    this.view = undefined;
    this.htmlReady = false;
    const generation = ++this.generation;
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
    const keydown = (event: KeyboardEvent) => {
      if (!input.accepts(event)) {
        return;
      }
      event.stopPropagation();
      const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
      if (action === "next" || action === "previous") {
        event.preventDefault();
        this.focus = stepFocus(ACTIONS, this.focusedAction(), action);
        if (this.htmlReady && this.focus !== undefined) {
          this.view?.buttons[this.focus].focus();
        }
        this.renderControls();
      } else if (action === "press") {
        event.preventDefault();
        this.activate(this.focusedAction() ?? "continue");
      }
    };
    const keyup = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === " ") {
        event.preventDefault();
      }
    };
    this.input.keyboard?.on("keydown", keydown);
    this.input.keyboard?.on("keyup", keyup);
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.htmlReady || this.press) {
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
    if (sceneDomUi(this) !== undefined) {
      const view = createOpeningView(document, TEXT.dialogue);
      this.view = view;
      const frame = this.playback.frame();
      showOpeningCaption(this.layout, TEXT.lines[frame.beat.text]!, view);
      const stop = this.watchPresses(view);
      view.root.addEventListener("keydown", keydown);
      view.root.addEventListener("keyup", keyup);
      const urls = artFrameUrl(
        this,
        "ui-play-mark",
        this.buttons.continue.label.mark!.frame.name,
      ).then((url) => {
        if (this.generation === generation) {
          view.mark.src = url;
        }
        return [url];
      });
      const reveal = revealSceneView(this, view.root, urls);
      this.events.once("shutdown", () => {
        ++this.generation;
        this.htmlReady = false;
        reveal.cancel();
        stop();
        view.root.removeEventListener("keydown", keydown);
        view.root.removeEventListener("keyup", keyup);
        this.view = undefined;
      });
      mountSceneView(this, view.root);
      void reveal.revealed.then((ready) => {
        if (!ready || this.generation !== generation || this.playback.frame().finished) {
          return;
        }
        input.invalidate();
        this.press = undefined;
        this.htmlReady = true;
        this.caption.setVisible(false);
        this.ring?.setVisible(false);
        for (const button of Object.values(this.buttons)) {
          button.faces.normal.setVisible(false);
          button.faces.pressed.setVisible(false);
          button.label.label.setVisible(false);
          button.label.mark?.setVisible(false);
        }
        if (this.focus !== undefined) {
          view.buttons[this.focus].focus();
        }
      });
    }
  }

  override update(_time: number, delta: number): void {
    if (modalInput(this).accepts()) {
      this.playback.tick(delta / 1000);
    }
    this.drawFrame();
  }

  private focusedAction(): Action | undefined {
    if (!this.htmlReady) {
      return this.focus;
    }
    const active = this.view?.root.ownerDocument.activeElement;
    return ACTIONS.find((action) => this.view?.buttons[action] === active);
  }

  private watchPresses(view: OpeningView): () => void {
    const input = modalInput(this);
    const live = () => this.htmlReady && !this.playback.frame().finished;
    const controlAt = ({ target }: { readonly target: EventTarget | null }): Action | null => {
      if (!(target instanceof Element) || !view.root.contains(target)) {
        return null;
      }
      const action = target.closest<HTMLElement>("[data-control]")?.dataset.control;
      return action === "continue" || action === "skip" ? action : null;
    };
    const stop = followTaps<Action>(
      { preventDefault: true, target: view.root, view: view.root },
      input,
      {
        accepts: live,
        controlAt,
        land: (action) => focusTarget(view.buttons[action]),
        show: (held) =>
          ACTIONS.forEach((action) =>
            view.buttons[action].toggleAttribute("data-pressed", held === action),
          ),
        tap: (action) => this.activate(action),
      },
    );
    const click = (event: MouseEvent) => {
      const action = controlAt(event);
      if (event.detail === 0 && action !== null && live() && input.accepts()) {
        this.activate(action);
      }
    };
    const keep = (event: Event) => event.preventDefault();
    view.root.addEventListener("click", click);
    view.root.addEventListener("touchstart", keep, { capture: true, passive: false });
    view.root.addEventListener("touchend", keep, { capture: true, passive: false });
    return () => {
      stop();
      view.root.removeEventListener("click", click);
      view.root.removeEventListener("touchstart", keep, true);
      view.root.removeEventListener("touchend", keep, true);
    };
  }

  private actionAt(at: Point): Action | undefined {
    return pressedArea(
      ACTIONS.map((key) => ({
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
    if (this.htmlReady || this.playback.frame().finished) {
      return;
    }
    for (const action of ACTIONS) {
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
      if (this.view !== undefined) {
        showOpeningCaption(this.layout, text, this.view);
      }
      this.beat = frame.beat;
    }
  }
}
