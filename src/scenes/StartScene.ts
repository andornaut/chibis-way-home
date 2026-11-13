import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { browserExitPage, exitApp } from "@andornaut/game-kit/web/pwa/dom/exitApp";
import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import { type GameObjects, type Input, Scene } from "phaser";

import { TEXT } from "../data/text.ts";
import type { Rect } from "../data/types/index.ts";
import { openingDestination } from "../progress/index.ts";
import { coverZone, exitShown, PHONE_EVENTS, startScreenShown } from "../pwa/index.ts";
import {
  createStart,
  focusKeyAction,
  type IconButtonLayout,
  type PressArea,
  pressedArea,
  setTouchSettingShown,
  startBackAction,
  type StartScreenLayout,
  startScreenLayout,
  type StartView,
  stepFocus,
  type TouchSetting,
} from "../ui/index.ts";
import type {
  AchievementsData,
  AchievementsOpener,
  AchievementsScene,
} from "./AchievementsScene.ts";
import {
  addSlice,
  addTextButton,
  captureTab,
  paletteColour,
  pressTextButton,
  PRIMARY_BUTTON,
  ringFocus,
  type TextButton,
} from "./cardParts.ts";
import { followTaps } from "./domTaps.ts";
import { artFrameUrl, mountSceneView, revealSceneView, sceneDomUi } from "./domUi.ts";
import { modalInput, onScenePointer } from "./modalInput.ts";
import { fitPlayCamera, playPoint } from "./playCamera.ts";
import type { RestartData, RestartOpener, RestartScene } from "./RestartScene.ts";
import { savedProgress } from "./save.ts";
import type { SettingsData, SettingsOpener, SettingsScene } from "./SettingsScene.ts";
import { uiObject } from "./uiRoots.ts";

const ACHIEVEMENTS = "achievements";
const BACKGROUND = "start-background";
const LOGO = "logo";
const RESTART = "restart";
const SETTINGS = "settings";

type Control = "achievements" | "exit" | "restart" | "settings" | "start";
type NavControl = "achievements" | "exit" | "settings";
// The card over the start screen, if one shows.
type Card = "achievements" | "restart" | "settings";

interface IconButton {
  readonly face: GameObjects.Sprite;
  readonly icon: GameObjects.Image;
  readonly layout: IconButtonLayout;
}

// The screen the game opens on without saved progress, and that Back to title goes to: the Start
// button, which opens the map (Continue, with him where he stands, once progress is saved),
// under a nav bar with Achievements, Settings and Exit at its right end. Achievements opens the
// Achievements card over this screen, Settings the settings card, and Restart the restart card;
// the card that shows takes the keys and back until it closes. Exit, and back with no card open,
// leave the browser game. Installed app windows keep Settings without Exit when closing is
// unsupported (exitShown), and back there is the browser's own. A control acts when a press lands
// on it and lifts on it.
export class StartScene extends Scene implements AchievementsOpener, RestartOpener, SettingsOpener {
  // The nav's icon buttons: Achievements, Settings and, where the game can exit, Exit.
  private buttons = new Map<NavControl, IconButton>();
  private layout!: StartScreenLayout;
  // The control a press landed on, which acts if the press lifts on it too.
  private pressed: Control | undefined;
  // The control the keyboard's focus is on, and art's ring round it.
  private focus: Control | undefined;
  private focusRing: GameObjects.NineSlice | undefined;
  private card: Card | undefined;
  private starting = false;
  private startButton!: TextButton;
  private restartButton: TextButton | undefined;
  private view: StartView | undefined;
  private native = false;
  private fallback: GameObjects.GameObject[] = [];

  constructor() {
    super("start");
  }

  create(): void {
    this.starting = false;
    this.native = false;
    this.view = undefined;
    fitPlayCamera(this);
    this.pressed = undefined;
    this.card = undefined;
    this.focus = undefined;
    this.focusRing = undefined;
    const logoFrame = this.textures.getFrame(LOGO);
    this.layout = startScreenLayout(
      { height: logoFrame.realHeight, width: logoFrame.realWidth },
      exitShown(),
      savedProgress().at !== "beginning",
    );
    this.draw();
    this.mountNative();
    this.showPressed(undefined);
    this.watchPresses();
    modalInput(this).subscribe(() => this.showPressed(undefined));
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.key(event));
    const onBack = (event: Event) => {
      const action = startBackAction(this.card !== undefined, this.layout.exit !== undefined);
      if (action === "closeCard") {
        const card = this.cardScene();
        if (modalInput(card).accepts(event)) {
          card.back();
        }
      } else if (action === "exit" && modalInput(this).accepts(event)) {
        this.act("exit");
      }
    };
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    captureTab(this, true);
    this.events.once("shutdown", () => {
      startScreenShown(false);
      coverZone("startCard", false);
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack);
      captureTab(this, false);
    });
    startScreenShown(true);
  }

  // The start screen has no zone to show the setting in: saving it is enough.
  setTouchSetting(setting: TouchSetting, shown: boolean): void {
    setTouchSettingShown(setting, shown);
  }

  settingsClosed(): void {
    this.card = undefined;
    coverZone("startCard", false);
    this.drawFocus();
  }

  restartClosed(): void {
    this.card = undefined;
    coverZone("startCard", false);
    this.drawFocus();
  }

  achievementsClosed(): void {
    this.card = undefined;
    coverZone("startCard", false);
    this.drawFocus();
  }

  // The static logical-view background stays behind the logo, nav and actions.
  private draw(): void {
    const { achievements, exit, logo, nav, restart, settings, start } = this.layout;
    this.cameras.main.setBackgroundColor(this.colour("ink"));
    this.add.image(0, 0, BACKGROUND).setOrigin(0);
    const firstUi = this.children.list.length;
    addSlice(this, "ui-nav-bar", nav);
    this.add.image(logo.x, logo.y, LOGO).setOrigin(0).setDisplaySize(logo.width, logo.height);
    this.buttons = new Map([
      ["achievements", this.iconButton(achievements, "icon-achievements")],
      ["settings", this.iconButton(settings, "icon-settings-nav")],
      ...(exit === undefined ? [] : [["exit", this.iconButton(exit, "ui-quit")] as const]),
    ]);
    this.startButton = addTextButton(
      this,
      start,
      restart === undefined ? TEXT.start.start : TEXT.start.continue,
      { style: PRIMARY_BUTTON },
    );
    this.restartButton =
      restart === undefined ? undefined : addTextButton(this, restart, TEXT.start.restart);
    this.fallback = this.children.list.slice(firstUi);
    this.fallback.forEach((object) => uiObject(this, object));
  }

  private mountNative(): void {
    const layer = sceneDomUi(this);
    if (layer === undefined) {
      return;
    }
    const view = createStart(layer.element.ownerDocument, TEXT.start, this.layout);
    this.view = view;
    const input = modalInput(this);
    const live = () => this.native && !this.starting && this.card === undefined;
    const controlAt = (event: Event): Control | null => {
      const target = event.target;
      return target instanceof Element && view.root.contains(target)
        ? ((target.closest<HTMLElement>("[data-control]")?.dataset.control as
            Control | undefined) ?? null)
        : null;
    };
    const stop = followTaps<Control>(
      { preventDefault: true, target: view.root, view: view.root },
      input,
      {
        accepts: live,
        controlAt,
        land: (control) => {
          this.focus = control;
          focusTarget(view.buttons.get(control)!);
        },
        show: (control) => this.showPressed(control),
        tap: (control) => this.act(control),
      },
    );
    const click = (event: MouseEvent) => {
      const control = controlAt(event);
      if (event.detail === 0 && control !== null && live() && input.accepts(event)) {
        this.focus = control;
        this.act(control);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (
        !live() ||
        !input.accepts(event) ||
        focusKeyAction(event.key, event.shiftKey, false) === undefined
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.key(event);
    };
    const focus = () => {
      for (const [control, button] of view.buttons) {
        if (button === view.root.ownerDocument.activeElement) {
          this.focus = control;
        }
      }
    };
    const keep = (event: Event) => event.preventDefault();
    view.root.addEventListener("click", click);
    view.root.addEventListener("keydown", key);
    view.root.addEventListener("focusin", focus);
    view.root.addEventListener("touchstart", keep, { capture: true, passive: false });
    view.root.addEventListener("touchend", keep, { capture: true, passive: false });
    const art = {
      achievements: "icon-achievements",
      exit: "ui-quit",
      logo: LOGO,
      settings: "icon-settings-nav",
    };
    const urls = Promise.all(
      [...view.images].map(async ([name, image]) => {
        const key = art[name as keyof typeof art];
        const frame = this.textures.getFrame(key);
        if (name !== "logo") {
          writeLayoutProperties(
            { "--start-height": frame.realHeight, "--start-width": frame.realWidth },
            image,
          );
        }
        const url = await artFrameUrl(this, key);
        image.setAttribute("src", url);
        return url;
      }),
    );
    const reveal = revealSceneView(this, view.root, urls);
    mountSceneView(this, view.root);
    let active = true;
    this.events.once("shutdown", () => {
      active = false;
      reveal.cancel();
      stop();
      view.root.removeEventListener("click", click);
      view.root.removeEventListener("keydown", key);
      view.root.removeEventListener("focusin", focus);
      view.root.removeEventListener("touchstart", keep, true);
      view.root.removeEventListener("touchend", keep, true);
    });
    void reveal.revealed.then((ready) => {
      if (!ready || !active || this.view !== view) {
        return;
      }
      this.showPressed(undefined);
      this.native = true;
      for (const object of this.fallback) {
        (object as GameObjects.Image).setVisible(false);
      }
      this.focusRing?.setVisible(false);
      this.drawFocus();
    });
  }

  // A nav icon button: its face, and its icon (the icon's first frame) over it.
  private iconButton(layout: IconButtonLayout, icon: string): IconButton {
    return {
      face: this.add.sprite(layout.at.x, layout.at.y, "ui-icon-button").setOrigin(0),
      icon: this.add.image(layout.icon.x, layout.icon.y, icon).setOrigin(0),
      layout,
    };
  }

  // A pressed control shows its pressed look until the press lifts: Start's face and label sink,
  // and a nav button's face sinks with its icon.
  private showPressed(control: Control | undefined): void {
    this.pressed = control;
    if (this.native) {
      for (const [name, button] of this.view?.buttons ?? []) {
        button.toggleAttribute("data-pressed", name === control);
      }
      return;
    }
    pressTextButton(this.startButton, control === "start");
    if (this.restartButton) {
      pressTextButton(this.restartButton, control === "restart");
    }
    for (const [name, { face, icon, layout }] of this.buttons) {
      const pressed = control === name;
      face.play(animationKey("ui-icon-button", pressed ? "pressed" : "normal"));
      icon.setY(pressed ? layout.pressedIcon.y : layout.icon.y);
    }
  }

  private controlAt(pointer: Input.Pointer): Control | undefined {
    const { achievements, exit, restart, settings, start } = this.layout;
    const areas: PressArea<Control>[] = [
      { art: achievements.art, hit: achievements.hit, key: "achievements" },
      ...(exit === undefined ? [] : [{ art: exit.art, hit: exit.hit, key: "exit" as const }]),
      ...(restart === undefined
        ? []
        : [{ art: restart.button, hit: restart.hit, key: "restart" as const }]),
      { art: settings.art, hit: settings.hit, key: "settings" },
      { art: start.button, hit: start.hit, key: "start" },
    ];
    return pressedArea(areas, playPoint(this, pointer));
  }

  private watchPresses(): void {
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      if (this.native) {
        return;
      }
      // While a card shows, nothing on the start screen responds.
      this.showPressed(this.card === undefined ? this.controlAt(pointer) : undefined);
    });
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => {
      if (this.native) {
        return;
      }
      const control = this.pressed;
      this.showPressed(undefined);
      if (control !== undefined && control === this.controlAt(pointer)) {
        this.act(control);
      }
    });
  }

  // Tab and the arrows move the keyboard's focus through Start, Restart and the nav's buttons; Enter and
  // Space press the focused one, or Start with nothing focused.
  private key(event: KeyboardEvent): void {
    // The cards take their keys in the page (src/ui/dom).
    if (this.card !== undefined) {
      return;
    }
    if (!modalInput(this).accepts(event)) {
      return;
    }
    const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
    if (action === "next" || action === "previous") {
      this.focus = stepFocus(this.targets(), this.focus, action);
      this.drawFocus();
    } else if (action === "press") {
      this.act(this.focus ?? "start");
    }
  }

  // The controls the keyboard's focus moves through, in order.
  private targets(): Control[] {
    return [
      "start",
      ...(this.layout.restart === undefined ? [] : ["restart" as const]),
      "achievements",
      "settings",
      ...(this.layout.exit === undefined ? [] : ["exit" as const]),
    ];
  }

  // Art's focus ring round Start's face or a nav button's face.
  private drawFocus(): void {
    if (this.native) {
      if (this.card === undefined && this.focus !== undefined) {
        const button = this.view?.buttons.get(this.focus);
        if (button) {
          focusTarget(button);
        }
      }
      return;
    }
    const faceOf = (control: Control): Rect | undefined => {
      if (control === "start" || control === "restart") {
        return this.layout[control]?.button;
      }
      const button = this.buttons.get(control);
      return (
        button && { height: button.face.height, width: button.face.width, ...button.layout.at }
      );
    };
    const rect =
      this.focus === undefined || this.card !== undefined ? undefined : faceOf(this.focus);
    this.focusRing = ringFocus(this, this.focusRing, rect);
    if (this.focusRing !== undefined) {
      uiObject(this, this.focusRing);
    }
  }

  private act(control: Control): void {
    if (control === "start") {
      if (this.starting) {
        return;
      }
      this.starting = true;
      // Unseen new games show the opening; Continue returns directly to the map.
      this.scene.start(openingDestination(savedProgress()));
    } else if (control === "achievements") {
      this.card = "achievements";
      coverZone("startCard", true);
      this.drawFocus();
      this.scene.launch(ACHIEVEMENTS, { opener: this.scene.key } satisfies AchievementsData);
    } else if (control === "settings") {
      this.card = "settings";
      coverZone("startCard", true);
      this.drawFocus();
      this.scene.launch(SETTINGS, { opener: this.scene.key } satisfies SettingsData);
    } else if (control === "restart") {
      this.card = "restart";
      coverZone("startCard", true);
      this.drawFocus();
      this.scene.launch(RESTART, { opener: this.scene.key } satisfies RestartData);
    } else {
      exitApp(browserExitPage());
    }
  }

  // The card that shows, which takes back.
  private cardScene(): AchievementsScene | RestartScene | SettingsScene {
    const key = { achievements: ACHIEVEMENTS, restart: RESTART, settings: SETTINGS }[
      this.card ?? "settings"
    ];
    return this.scene.get(key) as AchievementsScene | RestartScene | SettingsScene;
  }

  private colour(name: string): number {
    return paletteColour(this, name);
  }
}
