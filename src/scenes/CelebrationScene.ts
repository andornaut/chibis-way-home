import { animationKey, type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { type GameObjects, type Input, Scene } from "phaser";

import { TEXT } from "../data/text.ts";
import { PHONE_EVENTS } from "../pwa/index.ts";
import {
  CELEBRATION,
  type CelebrationView,
  createCelebrationView,
  focusKeyAction,
  type PressArea,
  pressedArea,
  stepFocus,
} from "../ui/index.ts";
import {
  addButtonLabel,
  addCardText,
  addCardTitle,
  addSlice,
  addTextButton,
  BODY_FONT,
  type ButtonLabel,
  captureTab,
  paletteColour,
  placeButtonLabel,
  pressTextButton,
  ringFocus,
  type TextButton,
} from "./cardParts.ts";
import { followTaps } from "./domTaps.ts";
import { artFrameUrl, mountSceneView, revealSceneView } from "./domUi.ts";
import { modalInput, onScenePointer } from "./modalInput.ts";
import { fitPlayCamera, playPoint } from "./playCamera.ts";
import type { RestartData, RestartOpener, RestartScene } from "./RestartScene.ts";

const MAP = "map";
const RESTART = "restart";

// The screen's buttons, in the order the keyboard's focus moves through them: Continue then
// Restart, though Restart is drawn on the left.
type Control = "continue" | "restart";
const CONTROLS: readonly Control[] = ["continue", "restart"];

// PLACEHOLDER: the celebration after he clears a last zone (one whose path leads on to the map's
// finish), every time he clears it, until art draws one: the settings card's parts over ink,
// with Continue, which opens the map with him on that zone, and Restart, which asks on the
// restart card and passes it back while it shows. A button acts when a press lands
// on it and lifts on it; Tab and the arrows move the keyboard's focus, and Enter and Space press
// the focused one, or Continue with nothing focused.
export class CelebrationScene extends Scene implements RestartOpener {
  private domReady = false;
  private view: CelebrationView | undefined;
  private finished = false;
  private generation = 0;
  private continueFace!: GameObjects.Sprite;
  private continueLabel!: ButtonLabel;
  private focus: Control | undefined;
  private focusRing: GameObjects.NineSlice | undefined;
  // The control a press landed on, which acts if the press lifts on it too.
  private pressed: Control | undefined;
  private restartButton!: TextButton;
  private restartOpen = false;

  constructor() {
    super("celebration");
  }

  create(): void {
    fitPlayCamera(this);
    this.domReady = false;
    this.view = undefined;
    this.finished = false;
    const generation = ++this.generation;
    this.focus = undefined;
    this.focusRing = undefined;
    this.pressed = undefined;
    this.restartOpen = false;
    const { card, message } = CELEBRATION;
    const words = TEXT.celebration;
    this.cameras.main.setBackgroundColor(this.colour("ink"));
    addSlice(this, "ui-settings-card", card);
    addCardTitle(this, card, words.title);
    addCardText(this, BODY_FONT, message, words.message, this.colour("ink"));
    this.restartButton = addTextButton(this, CELEBRATION.restart, words.restart);
    const go = CELEBRATION.continue;
    this.continueFace = this.add.sprite(go.button.x, go.button.y, "ui-resume").setOrigin(0);
    this.continueLabel = addButtonLabel(
      this,
      {
        colour: this.colour("ink"),
        marked: true,
      },
      go.button,
      words.continue,
    );
    this.render();
    const input = modalInput(this);
    input.ready(true);
    this.watchFallbackPresses();
    const view = createCelebrationView(document, words);
    this.view = view;
    const urls = Promise.all(
      (["normal", "pressed", "mark"] as const).map(async (key) => {
        const art = key === "mark" ? "ui-play-mark" : "ui-resume";
        const tag = key === "mark" ? "rest" : key;
        const frame = sheetTags(this.cache.json.get(art) as AsepriteSheet).get(tag)?.[0]?.frame;
        if (frame === undefined) {
          throw new Error(`No ${tag} frame for ${art}`);
        }
        const url = await artFrameUrl(this, art, frame);
        if (this.generation === generation) {
          view.images[key].src = url;
        }
        return url;
      }),
    );
    const fallback = [...this.children.list];
    const reveal = revealSceneView(this, view.root, urls);
    mountSceneView(this, view.root);
    void reveal.revealed.then((ready) => {
      if (!ready || this.finished || this.generation !== generation) {
        return;
      }
      this.domReady = true;
      this.pressed = undefined;
      this.focusRing?.destroy();
      this.focusRing = undefined;
      fallback.forEach((object) => object.destroy());
      if (this.focus !== undefined && !this.restartOpen) {
        focusTarget(view.buttons[this.focus]);
      }
      this.watchPresses(view);
    });
    const onKey = (event: KeyboardEvent) => this.key(event);
    const onKeyUp = (event: KeyboardEvent) => {
      if (
        !this.restartOpen &&
        input.accepts(event) &&
        (event.key === " " || event.key === "Enter")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    this.events.once("shutdown", () => {
      ++this.generation;
      reveal.cancel();
      this.view = undefined;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKeyUp);
    });
    modalInput(this).subscribe(() => {
      this.pressed = undefined;
      this.render();
    });

    const onBack = (event: Event) => {
      if (this.restartOpen) {
        const card = this.restartCard();
        if (modalInput(card).accepts(event)) {
          card.back();
        }
      }
    };
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    captureTab(this, true);
    this.events.once("shutdown", () => {
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack);
      captureTab(this, false);
    });
  }

  restartClosed(): void {
    this.restartOpen = false;
    this.render();
    if (this.domReady && this.view !== undefined) {
      focusTarget(this.view.buttons.restart);
    }
  }

  private watchFallbackPresses(): void {
    const controlAt = (pointer: Input.Pointer): Control | undefined => {
      const areas: PressArea<Control>[] = CONTROLS.map((key) => ({
        art: CELEBRATION[key].button,
        hit: CELEBRATION[key].hit,
        key,
      }));
      return pressedArea(areas, playPoint(this, pointer));
    };
    onScenePointer(this, "pointerdown", (pointer) => {
      if (this.domReady || this.finished || this.restartOpen) {
        return;
      }
      this.pressed = controlAt(pointer);
      this.render();
    });
    onScenePointer(this, "pointerup", (pointer) => {
      if (this.domReady) {
        return;
      }
      const pressed = this.pressed;
      this.pressed = undefined;
      this.render();
      if (pressed !== undefined && pressed === controlAt(pointer)) {
        this.act(pressed);
      }
    });
    onScenePointer(this, "pointerupoutside", () => {
      this.pressed = undefined;
      this.render();
    });
  }

  private watchPresses(view: CelebrationView): void {
    const controlAt = (target: EventTarget | null): Control | null =>
      CONTROLS.find((key) => target instanceof Node && view.buttons[key].contains(target)) ?? null;
    const stop = followTaps<Control>(
      { preventDefault: true, target: view.root, view: view.root },
      modalInput(this),
      {
        accepts: () => !this.finished && !this.restartOpen,
        controlAt: ({ target }) => controlAt(target),
        land: (key) => focusTarget(view.buttons[key]),
        show: (key) =>
          CONTROLS.forEach((control) =>
            view.buttons[control].toggleAttribute("data-pressed", control === key),
          ),
        tap: (key) => this.act(key),
      },
    );
    const click = (event: MouseEvent) => {
      const key = controlAt(event.target);
      if (event.detail === 0 && key !== null) {
        this.act(key);
      }
    };
    view.root.addEventListener("click", click);
    this.events.once("shutdown", () => {
      stop();
      view.root.removeEventListener("click", click);
    });
  }

  private key(event: KeyboardEvent): void {
    // The restart card takes its keys in the page (src/ui/dom).
    if (this.restartOpen) {
      return;
    }
    if (!modalInput(this).accepts(event)) {
      return;
    }
    const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
    if (action !== undefined || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
    }
    const view = this.domReady ? this.view : undefined;
    if (view !== undefined) {
      this.focus = CONTROLS.find((key) => view.buttons[key] === document.activeElement);
    }
    if (action === "next" || action === "previous") {
      this.focus = stepFocus([...CONTROLS], this.focus, action);
      if (view === undefined) {
        this.render();
      } else {
        focusTarget(view.buttons[this.focus!]);
      }
    } else if (action === "press") {
      this.act(this.focus ?? "continue");
    }
  }

  private act(control: Control): void {
    if (this.finished || this.restartOpen || !modalInput(this).accepts()) {
      return;
    }
    if (control === "continue") {
      this.finished = true;
      modalInput(this).ready(false);
      this.scene.start(MAP);
    } else {
      this.restartOpen = true;
      this.render();
      this.scene.launch(RESTART, { opener: this.scene.key } satisfies RestartData);
    }
  }

  // Each button as the press leaves it, and art's focus ring round the focused one while no card
  // shows.
  private render(): void {
    if (this.domReady) {
      return;
    }
    const continuing = this.pressed === "continue";
    this.continueFace.play(animationKey("ui-resume", continuing ? "pressed" : "normal"));
    placeButtonLabel(continuing, false, this.continueLabel);
    pressTextButton(this.restartButton, this.pressed === "restart");
    const focused =
      this.focus === undefined || this.restartOpen ? undefined : CELEBRATION[this.focus].button;
    this.focusRing = ringFocus(this, this.focusRing, focused);
  }

  private restartCard(): RestartScene {
    return this.scene.get(RESTART) as RestartScene;
  }

  private colour(name: string): number {
    return paletteColour(this, name);
  }
}
