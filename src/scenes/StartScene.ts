import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { Scene } from "phaser";

import { START_EXIT_TEXT, TEXT } from "../data/text.ts";
import { openingDestination } from "../progress/index.ts";
import {
  canLeavePlatformBack,
  closeApp,
  exitShown,
  leavePlatformBack,
  PHONE_EVENTS,
  requestUpdateCheck,
} from "../pwa/index.ts";
import {
  createStart,
  focusKeyAction,
  type StartScreenLayout,
  startScreenLayout,
  type StartView,
  stepFocus,
} from "../ui/index.ts";
import { bindSceneActions } from "./domTaps.ts";
import { artFrameUrl, mountSceneView, revealSceneView, sceneDomUi } from "./domUi.ts";
import type { ExitData, ExitScene } from "./ExitScene.ts";
import { captureTab } from "./keyboardCapture.ts";
import { modalInput } from "./modalInput.ts";
import { fitPlayCamera } from "./playCamera.ts";
import type { RestartData, RestartOpener, RestartScene } from "./RestartScene.ts";
import { savedProgress } from "./save.ts";
import { paletteColour } from "./scenePalette.ts";

const BACKGROUND = "start-background";
const LOGO = "logo";
const RESTART = "restart";

type Control = "exit" | "restart" | "start";
// The card over the start screen, if one shows.
type Card = "exit" | "restart";

export interface StartData {
  readonly returnedToTitle?: true;
}

// The screen the game opens on without saved progress, and that Back to title goes to: the Start
// button, which opens the map (Continue, with him where he stands, once progress is saved),
// under a nav bar with Exit at its right end only in an app window a script can close (exitShown).
// Restart opens the restart card; the card that shows takes the keys and back until it closes.
// Explicit Exit closes the window. Platform Back on bare Start asks before its native
// continuation; nested cards retain their own Back. A control acts on a fresh release.
export class StartScene extends Scene implements RestartOpener {
  private layout!: StartScreenLayout;
  private focus: Control | undefined;
  private card: Card | undefined;
  private starting = false;
  private view: StartView | undefined;
  private native = false;
  private checkedArrival: StartData | undefined;

  constructor() {
    super("start");
  }

  pausable(): boolean {
    return false;
  }

  create(data?: StartData): void {
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
    if (sceneDomUi(this) === undefined) {
      this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.key(event));
    }
    const onBack = (event: Event) => {
      if (this.card !== undefined) {
        const card = this.cardScene();
        if (modalInput(card).accepts(event)) {
          card.back();
        }
      } else if (!this.starting && modalInput(this).accepts(event)) {
        this.card = "exit";
        this.scene.launch("exit", {
          accepted: leavePlatformBack,
          canLeave: canLeavePlatformBack,
          cancelled: () => {
            this.card = undefined;
            this.drawFocus();
          },
          words: START_EXIT_TEXT,
        } satisfies ExitData);
      }
    };
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    captureTab(this, true);
    this.events.once("shutdown", () => {
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack);
      captureTab(this, false);
    });
    // Phaser keeps the last scene data when restarted without a new payload.
    if (data?.returnedToTitle && data !== this.checkedArrival) {
      this.checkedArrival = data;
      requestUpdateCheck();
    }
  }

  restartClosed(): void {
    this.card = undefined;
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
    const view = createStart(
      layer.element.ownerDocument,
      {
        cream: this.colour("cream"),
        dslate: this.colour("dslate"),
        ink: this.colour("ink"),
        navy: this.colour("navy"),
        white: this.colour("white"),
      },
      TEXT.start,
      this.layout,
    );
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
    const stop = bindSceneActions<Control>(
      { preventDefault: true, target: view.root, view: view.root },
      input,
      {
        accepts: live,
        activate: (control) => {
          this.focus = control;
          this.act(control);
        },
        controlAt,
        controls: [...view.buttons.keys()],
        element: (control) => view.buttons.get(control)!,
        land: (control) => {
          this.focus = control;
          focusTarget(view.buttons.get(control)!);
        },
        show: (control) => this.showPressed(control),
      },
    );
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
    if (sceneDomUi(this) === undefined) {
      view.root.addEventListener("keydown", key);
    }
    view.root.addEventListener("focusin", focus);
    view.root.addEventListener("touchstart", keep, { capture: true, passive: false });
    view.root.addEventListener("touchend", keep, { capture: true, passive: false });
    const logo = artFrameUrl(this, LOGO).then((url) => {
      view.logo.src = url;
      return [url];
    });
    const reveal = revealSceneView(this, view.root, logo);
    mountSceneView(this, view.root);
    let active = true;
    this.events.once("shutdown", () => {
      active = false;
      reveal.cancel();
      stop();
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
      ...(this.layout.saved ? ["restart" as const] : []),
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
      requestUpdateCheck();
      // Unseen new games show the opening; Continue returns directly to the map.
      this.scene.start(openingDestination(savedProgress()));
    } else if (control === "restart") {
      this.card = "restart";
      this.drawFocus();
      this.scene.launch(RESTART, { opener: this.scene.key } satisfies RestartData);
    } else {
      closeApp();
    }
  }

  // The card that shows, which takes back.
  private cardScene(): ExitScene | RestartScene {
    return this.scene.get(this.card!) as ExitScene | RestartScene;
  }

  private colour(name: string): number {
    return paletteColour(this, name);
  }
}
