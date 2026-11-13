import { browserExitPage, exitApp } from "@andornaut/game-kit/web/pwa/dom/exitApp";
import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import { Scene } from "phaser";

import { TEXT } from "../data/text.ts";
import { openingDestination } from "../progress/index.ts";
import { coverZone, exitShown, PHONE_EVENTS, startScreenShown } from "../pwa/index.ts";
import {
  createStart,
  focusKeyAction,
  startBackAction,
  type StartScreenLayout,
  startScreenLayout,
  type StartView,
  stepFocus,
} from "../ui/index.ts";
import type {
  AchievementsData,
  AchievementsOpener,
  AchievementsScene,
} from "./AchievementsScene.ts";
import { followTaps } from "./domTaps.ts";
import { artFrameUrl, mountSceneView, revealSceneView, sceneDomUi } from "./domUi.ts";
import { captureTab } from "./keyboardCapture.ts";
import { modalInput } from "./modalInput.ts";
import { fitPlayCamera } from "./playCamera.ts";
import type { RestartData, RestartOpener, RestartScene } from "./RestartScene.ts";
import { savedProgress } from "./save.ts";
import { paletteColour } from "./scenePalette.ts";

const ACHIEVEMENTS = "achievements";
const BACKGROUND = "start-background";
const LOGO = "logo";
const RESTART = "restart";

type Control = "achievements" | "exit" | "restart" | "start";
// The card over the start screen, if one shows.
type Card = "achievements" | "restart";

// The screen the game opens on without saved progress, and that Back to title goes to: the Start
// button, which opens the map (Continue, with him where he stands, once progress is saved),
// under a nav bar with Achievements and Exit at its right end. Achievements opens the
// Achievements card over this screen, and Restart the restart card;
// the card that shows takes the keys and back until it closes. Exit, and back with no card open,
// leave the browser game. Installed app windows omit Exit when closing is
// unsupported (exitShown), and back there is the browser's own. A control acts when a press lands
// on it and lifts on it.
export class StartScene extends Scene implements AchievementsOpener, RestartOpener {
  private layout!: StartScreenLayout;
  private focus: Control | undefined;
  private card: Card | undefined;
  private starting = false;
  private view: StartView | undefined;
  private native = false;

  constructor() {
    super("start");
  }

  create(): void {
    this.starting = false;
    this.native = false;
    this.view = undefined;
    fitPlayCamera(this);
    this.card = undefined;
    this.focus = undefined;
    const logoFrame = this.textures.getFrame(LOGO);
    this.layout = startScreenLayout(
      { height: logoFrame.realHeight, width: logoFrame.realWidth },
      exitShown(),
      savedProgress().at !== "beginning",
    );
    modalInput(this).ready(false);
    this.draw();
    this.mountNative();
    this.showPressed(undefined);
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
    this.cameras.main.setBackgroundColor(this.colour("ink"));
    this.add.image(0, 0, BACKGROUND).setOrigin(0);
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
      input.ready(true);
      this.drawFocus();
    });
  }

  private showPressed(control: Control | undefined): void {
    for (const [name, button] of this.view?.buttons ?? []) {
      button.toggleAttribute("data-pressed", name === control);
    }
  }

  // Tab and the arrows move the keyboard's focus through Start, Restart and the nav's buttons; Enter and
  // Space press the focused one, or Start with nothing focused.
  private key(event: KeyboardEvent): void {
    // The cards take their keys in the page (src/ui/dom).
    if (!this.native || this.card !== undefined) {
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
      ...(this.layout.exit === undefined ? [] : ["exit" as const]),
    ];
  }

  private drawFocus(): void {
    if (this.card === undefined && this.focus !== undefined) {
      const button = this.view?.buttons.get(this.focus);
      if (button) {
        focusTarget(button);
      }
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
  private cardScene(): AchievementsScene | RestartScene {
    const key = this.card === "achievements" ? ACHIEVEMENTS : RESTART;
    return this.scene.get(key) as AchievementsScene | RestartScene;
  }

  private colour(name: string): number {
    return paletteColour(this, name);
  }
}
