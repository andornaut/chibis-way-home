import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { snapshotRemapped } from "@andornaut/game-kit/view/phaser/snapshotRemap";
import { type GameObjects, type Input, Scene } from "phaser";

import { TEXT } from "../data/text";
import type { Rect } from "../data/types";
import { type PressArea, pressedArea } from "../layout/hitAreas";
import { playView } from "../layout/playView";
import {
  type IconButtonLayout,
  type StartScreenLayout,
  startScreenLayout,
} from "../layout/startScreen";
import { startBackAction } from "../pause/cardInput";
import { focusKeyAction, stepFocus } from "../pause/focusInput";
import { browserExitPage, exitApp } from "../platform/pwa/exitApp";
import {
  beginStartUpdateVisit,
  coverZone,
  exitShown,
  PHONE_EVENTS,
  startScreenShown,
} from "../pwa";
import { openingDestination } from "../rules/opening";
import { savedProgress } from "../save";
import { setTouchSettingShown, type TouchSetting } from "../settings/touchControls";
import { dimColour } from "../view/dim";
import {
  addSlice,
  addTextButton,
  captureTab,
  palette,
  paletteColour,
  pressTextButton,
  PRIMARY_BUTTON,
  ringFocus,
  type TextButton,
} from "./cardParts";
import { modalInput, onScenePointer } from "./modalInput";
import { fitPlayCamera, playPoint } from "./playCamera";
import type { RestartData, RestartOpener, RestartScene } from "./RestartScene";
import type { SettingsData, SettingsOpener, SettingsScene } from "./SettingsScene";
import type { ZoneData } from "./ZoneScene";

const LOGO = "logo";
const RESTART = "restart";
const SETTINGS = "settings";
const ZONE = "zone";
// Zone 1's street dimmed, read back once and kept for every later visit to the start screen.
const STREET_DIM = "start-street-dim";

type Control = "exit" | "restart" | "settings" | "start";
// The card over the start screen, if one shows.
type Card = "restart" | "settings";

interface IconButton {
  readonly face: GameObjects.Sprite;
  readonly icon: GameObjects.Image;
  readonly layout: IconButtonLayout;
}

// The screen the game opens on without saved progress, and that Back to title goes to: the Start
// button, which opens the map (Continue, with her where she stands, once progress is saved),
// under a nav bar with Settings and Exit at its right end. Settings opens the settings card over
// this screen, and Restart the restart card; the card that shows takes the keys and back until it
// closes. Exit, and back with no card open, leave the game (the kit's exitApp). An installed app
// whose window the game cannot close shows no Exit (exitShown), and back there is the browser's
// own. A control acts when a press lands on it and lifts on it.
export class StartScene extends Scene implements RestartOpener, SettingsOpener {
  // The nav's icon buttons: Settings and, where the game can exit, Exit.
  private buttons = new Map<"exit" | "settings", IconButton>();
  private layout!: StartScreenLayout;
  // The control a press landed on, which acts if the press lifts on it too.
  private pressed: Control | undefined;
  // The control the keyboard's focus is on, and art's ring round it.
  private focus: Control | undefined;
  private focusRing: GameObjects.NineSlice | undefined;
  private card: Card | undefined;
  private startButton!: TextButton;
  private restartButton: TextButton | undefined;
  private street!: GameObjects.Image;

  constructor() {
    super("start");
  }

  create(): void {
    beginStartUpdateVisit();
    let currentCreate = true;
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
    void this.showStreet().then(() => {
      if (currentCreate && this.sys.isActive()) {
        startScreenShown(true);
      }
    });
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
      currentCreate = false;
      startScreenShown(false);
      coverZone("startCard", false);
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack);
      captureTab(this, false);
    });
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

  // Zone 1's street dimmed behind everything, over plain ink until it is read back.
  private draw(): void {
    const { exit, logo, nav, restart, settings, start } = this.layout;
    this.cameras.main.setBackgroundColor(this.colour("ink"));
    this.street = this.add.image(0, 0, "__DEFAULT").setOrigin(0).setVisible(false);
    addSlice(this, "ui-nav-bar", nav);
    this.add.image(logo.x, logo.y, LOGO).setOrigin(0).setDisplaySize(logo.width, logo.height);
    this.buttons = new Map([
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
  }

  // Shows the dimmed street, reading it back first if no visit has yet. Nothing of this scene is
  // drawn while the street is read back, and the canvas is hidden over the page's ink meanwhile,
  // so the undimmed street never shows. Where the renderer gives no image, the ink stays.
  private async showStreet(): Promise<void> {
    if (!this.textures.exists(STREET_DIM)) {
      const camera = this.cameras.main.setVisible(false);
      const canvas = this.game.canvas.style;
      canvas.visibility = "hidden";
      await this.dimStreet();
      canvas.visibility = "";
      if (!this.sys.isActive()) {
        return;
      }
      camera.setVisible(true);
    }
    if (this.textures.exists(STREET_DIM)) {
      this.street.setTexture(STREET_DIM).setVisible(true);
    }
  }

  // Draws zone 1's street as ZoneScene's still backdrop, reads the frame it first renders in back
  // two steps down each colour's ramp, as the pause card dims the zone, and stops the zone.
  private dimStreet(): Promise<boolean> {
    return new Promise((resolve) => {
      this.scene.get(ZONE).events.once("create", () => {
        void snapshotRemapped(
          dimColour(palette(this)),
          this,
          playView(this.scale.gameSize),
          STREET_DIM,
        ).then((dimmed) => {
          this.scene.stop(ZONE);
          resolve(dimmed);
        });
      });
      this.scene.launch(ZONE, { backdrop: true } satisfies ZoneData);
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
    const { exit, restart, settings, start } = this.layout;
    const areas: PressArea<Control>[] = [
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
      // While a card shows, nothing on the start screen responds.
      this.showPressed(this.card === undefined ? this.controlAt(pointer) : undefined);
    });
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => {
      const control = this.pressed;
      this.showPressed(undefined);
      if (control !== undefined && control === this.controlAt(pointer)) {
        this.act(control);
      }
    });
  }

  // Tab and the arrows move the keyboard's focus through Start and the nav's buttons; Enter and
  // Space press the focused one, or Start with nothing focused.
  private key(event: KeyboardEvent): void {
    if (this.card !== undefined) {
      this.cardScene().key(event);
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
      "settings",
      ...(this.layout.exit === undefined ? [] : ["exit" as const]),
    ];
  }

  // Art's focus ring round Start's face or a nav button's face.
  private drawFocus(): void {
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
  }

  private act(control: Control): void {
    if (control === "start") {
      // Unseen new games show the opening; Continue returns directly to the map.
      this.scene.start(openingDestination(savedProgress()));
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

  // The card that shows, which takes the keys and back.
  private cardScene(): RestartScene | SettingsScene {
    return this.scene.get(this.card === "restart" ? RESTART : SETTINGS) as
      RestartScene | SettingsScene;
  }

  private colour(name: string): number {
    return paletteColour(this, name);
  }
}
