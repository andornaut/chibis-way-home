import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { type GameObjects, type Input, Scene } from "phaser";

import { TEXT } from "../data/text";
import { type PressArea, pressedArea } from "../layout/hitAreas";
import { CELEBRATION } from "../layout/restartCard";
import { focusKeyAction, stepFocus } from "../pause/focusInput";
import { PHONE_EVENTS } from "../pwa";
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
} from "./cardParts";
import { modalInput, onScenePointer } from "./modalInput";
import { fitPlayCamera, playPoint } from "./playCamera";
import type { RestartData, RestartOpener, RestartScene } from "./RestartScene";

const MAP = "map";
const RESTART = "restart";

// The screen's buttons, in the order the keyboard's focus moves through them.
type Control = "continue" | "restart";
const CONTROLS: readonly Control[] = ["restart", "continue"];

// PLACEHOLDER: the celebration after she clears a last zone (one whose path leads on to the map's
// finish), every time she clears it, until art draws one: the settings card's parts over ink,
// with Continue, which opens the map with her on that zone, and Restart, which asks on the
// restart card and passes it the keys and back while it shows. A button acts when a press lands
// on it and lifts on it; Tab and the arrows move the keyboard's focus, and Enter and Space press
// the focused one, or Continue with nothing focused.
export class CelebrationScene extends Scene implements RestartOpener {
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
    this.watchPresses();
    modalInput(this).subscribe(() => {
      this.pressed = undefined;
      this.render();
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.key(event));
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
  }

  private watchPresses(): void {
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.pressed = this.restartOpen ? undefined : this.controlAt(pointer);
      this.render();
    });
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => {
      const control = this.pressed;
      this.pressed = undefined;
      this.render();
      if (control !== undefined && control === this.controlAt(pointer)) {
        this.act(control);
      }
    });
  }

  private controlAt(pointer: Input.Pointer): Control | undefined {
    const areas: PressArea<Control>[] = CONTROLS.map((key) => ({
      art: CELEBRATION[key].button,
      hit: CELEBRATION[key].hit,
      key,
    }));
    return pressedArea(areas, playPoint(this, pointer));
  }

  private key(event: KeyboardEvent): void {
    if (this.restartOpen) {
      this.restartCard().key(event);
      return;
    }
    if (!modalInput(this).accepts(event)) {
      return;
    }
    const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
    if (action === "next" || action === "previous") {
      this.focus = stepFocus([...CONTROLS], this.focus, action);
      this.render();
    } else if (action === "press") {
      this.act(this.focus ?? "continue");
    }
  }

  private act(control: Control): void {
    if (control === "continue") {
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
