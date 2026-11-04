import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { type Cameras, type Game, type GameObjects, type Input, Scene } from "phaser";

import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import { PHONE_EVENTS, startWakeLock, stopWakeLock, updateOffer } from "../pwa";
import {
  cardActions,
  cardActionsSize,
  cardTextSize,
  contentCardLayout,
  type PressArea,
  pressedArea,
  stepFocus,
} from "../ui";
import {
  addCardTextIn,
  addSlice,
  addTextButton,
  captureTab,
  cardFonts,
  paletteColour,
  pressTextButton,
  PRIMARY_BUTTON,
  ringFocus,
  type TextButton,
  TITLE_FONT,
} from "./cardParts";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput, onScenePointer } from "./modalInput";
import { catchModalTaps } from "./modalTaps";
import { fitPlayCamera, playPoint } from "./playCamera";

// Pausing the world does not change PWA eligibility: closing this offer cannot reopen it.
export function installUpdateModalBridge(game: Game): void {
  let paused: string[] = [];
  const unsubscribe = updateOffer.subscribe((shown) => {
    if (shown) {
      paused = game.scene
        .getScenes(true)
        .filter((scene) => scene.scene.key !== "update")
        .map((scene) => scene.scene.key);
      for (const key of paused) {
        game.scene.pause(key);
      }
      stopWakeLock();
      game.scene.start("update");
    } else {
      if (game.scene.isActive("update")) {
        game.scene.stop("update");
      }
      for (const key of paused) {
        if (game.scene.isPaused(key)) {
          game.scene.resume(key);
        }
      }
      if (paused.includes("zone")) {
        startWakeLock();
      }
      paused = [];
    }
  });
  game.events.once("destroy", unsubscribe);
}

type ButtonAction = "accept" | "cancel";
type Action = ButtonAction | "close";

export class UpdateScene extends Scene {
  private cardCamera!: Cameras.Scene2D.Camera;
  private layout!: ReturnType<typeof contentCardLayout>;
  private actions!: Record<ButtonAction, ReturnType<typeof cardActions>[number]>;
  private buttons!: Record<ButtonAction, TextButton>;
  private closeX!: GameObjects.Sprite;
  private focus: Action | undefined;
  private readyToInteract = false;
  private ring: GameObjects.NineSlice | undefined;
  private press:
    | { at: { x: number; y: number }; cancelled: boolean; id: number; target: Action | undefined }
    | undefined;

  constructor() {
    super("update");
  }

  create(): void {
    this.readyToInteract = false;
    this.focus = undefined;
    this.ring = undefined;
    this.press = undefined;
    this.cardCamera = this.cameras.main;
    fitPlayCamera(this, this.cardCamera);
    const fonts = cardFonts(this);
    const labels = [TEXT.update.cancel, TEXT.update.accept];
    this.layout = contentCardLayout(
      { ...SCREEN, x: 0, y: 0 },
      [{ key: "actions", ...cardActionsSize(fonts.title, "row", labels) }],
      { close: true, titleWidth: cardTextSize(fonts.title, TEXT.update.title).width },
    );
    const group = this.layout.groups.actions;
    const title = this.layout.title;
    const close = this.layout.close;
    if (!group || !title || !close) {
      throw new Error("Missing upgrade card content");
    }
    const [cancel, accept] = cardActions(fonts.title, "row", group, labels);
    if (!accept || !cancel) {
      throw new Error("Missing upgrade action");
    }
    this.actions = { accept, cancel };
    addSlice(this, "ui-settings-card", this.layout.card);
    addCardTextIn(this, TITLE_FONT, title, TEXT.update.title, paletteColour(this, "ink"));
    this.closeX = this.add.sprite(close.at.x, close.at.y, "ui-close").setOrigin(0);
    this.closeX.play(animationKey("ui-close", "normal"));
    this.buttons = {
      accept: addTextButton(this, accept, TEXT.update.accept, { style: PRIMARY_BUTTON }),
      cancel: addTextButton(this, cancel, TEXT.update.cancel),
    };
    catchModalTaps(this, this.cardCamera, {
      close: () => updateOffer.defer(),
      covered: () => [this.layout.card, accept.hit, cancel.hit, close.hit],
    });
    captureTab(this, true);
    const back = (event: Event) => {
      if (!modalInput(this).accepts(event)) {
        return;
      }
      event.stopImmediatePropagation();
      updateOffer.defer();
    };
    window.addEventListener(PHONE_EVENTS.backPressed, back, true);
    this.events.once("shutdown", () => {
      captureTab(this, false);
      window.removeEventListener(PHONE_EVENTS.backPressed, back, true);
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!modalInput(this).accepts(event)) {
        return;
      }
      event.stopPropagation();
      if (event.key === "Escape") {
        updateOffer.defer();
      } else if (event.key === "Tab" || event.key.startsWith("Arrow")) {
        event.preventDefault();
        this.focus = stepFocus<Action>(
          ["cancel", "accept", "close"],
          this.focus,
          event.key === "ArrowLeft" ||
            event.key === "ArrowUp" ||
            (event.key === "Tab" && event.shiftKey)
            ? "previous"
            : "next",
        );
        this.render();
      } else if (
        (event.key === "Enter" || event.key === " ") &&
        !event.repeat &&
        this.focus !== undefined
      ) {
        event.preventDefault();
        this.act(this.focus);
      }
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => event.stopPropagation());
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.readyToInteract && !this.press) {
        const at = playPoint(this, pointer, this.cardCamera);
        this.press = {
          at,
          cancelled: false,
          id: pointer.id,
          target: pressedArea(this.areas(), at),
        };
        this.render();
      }
    });
    onScenePointer(this, "pointermove", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.press?.id === pointer.id) {
        const at = playPoint(this, pointer, this.cardCamera);
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
      const at = playPoint(this, pointer, this.cardCamera);
      if (
        !outside &&
        !pointer.wasCanceled &&
        !press.cancelled &&
        press.target !== undefined &&
        Math.hypot(at.x - press.at.x, at.y - press.at.y) <= TOUCH.tapMaxDistance &&
        pressedArea(this.areas(), at) === press.target
      ) {
        this.act(press.target);
      }
    };
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => up(pointer, false));
    onScenePointer(this, "pointerupoutside", (pointer: Input.Pointer) => up(pointer, true));
    const backdrop = showModalBackdrop(this);
    void backdrop.ready.then(() => {
      this.readyToInteract = this.sys.isActive();
    });
  }

  private areas(): readonly PressArea<Action>[] {
    const close = this.layout.close;
    return [
      { art: this.actions.accept.button, hit: this.actions.accept.hit, key: "accept" },
      { art: this.actions.cancel.button, hit: this.actions.cancel.hit, key: "cancel" },
      ...(close ? [{ art: close.art, hit: close.hit, key: "close" as const }] : []),
    ];
  }
  private act(action: Action): void {
    if (!this.readyToInteract) {
      return;
    }
    if (action === "accept") {
      updateOffer.accept();
    } else {
      updateOffer.defer();
    }
  }
  private render(): void {
    this.closeX.play(
      animationKey(
        "ui-close",
        this.press?.target === "close" && !this.press.cancelled ? "pressed" : "normal",
      ),
    );
    for (const key of ["accept", "cancel"] as const) {
      pressTextButton(this.buttons[key], this.press?.target === key && !this.press.cancelled);
    }
    this.ring = ringFocus(
      this,
      this.ring,
      this.focus === "accept" || this.focus === "cancel"
        ? this.actions[this.focus].button
        : this.focus === "close"
          ? this.layout.close?.art
          : undefined,
    );
  }
}
