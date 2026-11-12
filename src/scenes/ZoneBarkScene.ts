import { Scene, Scenes } from "phaser";

import { BARK_DURATION_SECONDS, SPEAKERS } from "../data/dialogues.ts";
import { TEXT } from "../data/text.ts";
import type { DialogueLine } from "../data/types/index.ts";
import type { ZoneBark } from "../rules/zone.ts";
import {
  createStatusPanel,
  type DialogueParagraph,
  dialogueParagraphs,
  onPanel,
  showPanelParagraph,
  type StatusPanelView,
} from "../ui/index.ts";
import { followTaps } from "./domTaps.ts";
import { artFrameUrl, mountSceneView } from "./domUi.ts";
import { modalInput } from "./modalInput.ts";

interface Bark {
  readonly line: DialogueLine;
  readonly onStart?: () => void;
  readonly owner?: ZoneBark["owner"] | undefined;
  readonly scheduled: boolean;
}

// Notices stay below every modal; only the current panel takes a fresh dismissal tap.
// A bark without an owner is an offscreen voice: no world actor gates or dismisses it.
// The panel is HTML in the UI layer (src/ui/dom/dialogue.ts), a polite status region under every
// modal's view, which dims it. It takes no presses itself, so a tap on it still reaches the
// canvas and the zone's touches under it; the scene reads the tap from the page (followTaps).
export class ZoneBarkScene extends Scene {
  private queue: Bark[] = [];
  private canPresent = () => false;
  private ownerVisible: (owner: ZoneBark["owner"]) => boolean = () => false;
  private current: Bark | undefined;
  private view: StatusPanelView | undefined;
  private remaining = 0;

  constructor() {
    super("zoneBark");
  }

  init(data: {
    readonly canPresent: () => boolean;
    readonly ownerVisible: (owner: ZoneBark["owner"]) => boolean;
  }): void {
    this.canPresent = data.canPresent;
    this.ownerVisible = data.ownerVisible;
    this.current = undefined;
    this.queue = [];
    this.view = undefined;
    this.remaining = 0;
  }

  create(): void {
    this.scene.moveAbove("zone", this.scene.key);
    // Every speaker's portrait is cut up front, once per game, so a bark's shows with its text.
    for (const portrait of new Set(
      Object.values(SPEAKERS).flatMap(({ portrait }) => portrait ?? []),
    )) {
      artFrameUrl(this, portrait).catch((error: unknown) =>
        console.warn("The bark portrait failed to load", error),
      );
    }
    const view = createStatusPanel(document, "zone-bark");
    this.view = view;
    const stopTaps = this.watchInput(view);
    const validateOwner = () => this.validateOwner();
    this.events.on(Scenes.Events.PRE_RENDER, validateOwner);
    this.events.once("shutdown", () => {
      this.events.off(Scenes.Events.PRE_RENDER, validateOwner);
      stopTaps();
      this.current = undefined;
      this.queue = [];
      this.view = undefined;
      this.remaining = 0;
    });
    mountSceneView(this, view.root);
  }

  // Whether a bark shows.
  private showing(): boolean {
    return this.view?.panel.element.hidden === false;
  }

  reset(): void {
    this.queue = [];
    this.clearCurrent();
  }

  private presentable(bark: Bark): boolean {
    return bark.owner === undefined || this.ownerVisible(bark.owner);
  }

  private validateOwner(): void {
    if (this.current && !this.presentable(this.current)) {
      this.clearCurrent();
    }
  }

  private clearCurrent(): void {
    this.current = undefined;
    if (this.view !== undefined) {
      this.view.panel.element.hidden = true;
    }
    this.remaining = 0;
  }

  // A fresh tap on the showing bark's panel or name tab, while it may show, dismisses it, and
  // never the bark that replaced it meanwhile.
  private watchInput(view: StatusPanelView): () => void {
    let pressed: Bark | undefined;
    const presentable = () =>
      this.showing() &&
      this.current !== undefined &&
      this.presentable(this.current) &&
      this.canPresent();
    return followTaps(
      { preventDefault: false, target: document, view: view.root },
      modalInput(this),
      {
        accepts: presentable,
        controlAt: ({ clientX, clientY }) =>
          onPanel(view.panel, clientX, clientY) ? "panel" : null,
        land: () => {
          pressed = this.current;
        },
        tap: () => {
          if (this.current === pressed) {
            this.clearCurrent();
          }
        },
      },
    );
  }

  idle(): boolean {
    return this.queue.length === 0 && !this.showing();
  }

  enqueue(line: DialogueLine, owner: ZoneBark["owner"]): void {
    const firstScheduled = this.queue.findIndex(({ scheduled }) => scheduled);
    this.queue.splice(firstScheduled < 0 ? this.queue.length : firstScheduled, 0, {
      line,
      owner,
      scheduled: false,
    });
  }

  offer(onStart: () => void, line: DialogueLine, owner?: ZoneBark["owner"]): boolean {
    const bark = { line, onStart, owner, scheduled: true };
    if (
      this.showing() ||
      this.queue.some((queued) => this.presentable(queued)) ||
      !this.canPresent() ||
      !this.presentable(bark)
    ) {
      return false;
    }
    this.queue.push(bark);
    return true;
  }

  override update(_time: number, delta: number): void {
    this.validateOwner();
    if (!this.canPresent()) {
      return;
    }
    if (this.showing()) {
      this.remaining -= delta;
      if (this.remaining > 0) {
        return;
      }
      this.clearCurrent();
    }
    const index = this.queue.findIndex((bark) => this.presentable(bark));
    if (index < 0) {
      return;
    }
    const bark = this.queue.splice(index, 1)[0]!;
    this.current = bark;
    const paragraph = dialogueParagraphs(SPEAKERS, TEXT, { lines: [bark.line] })[0]!;
    this.show(paragraph);
    this.remaining = BARK_DURATION_SECONDS * 1000;
    bark.onStart?.();
  }

  // Shows paragraph in the panel, its portrait once its cut is ready.
  private show(paragraph: DialogueParagraph): void {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    const { panel } = view;
    showPanelParagraph(panel, paragraph);
    panel.portrait.hidden = true;
    panel.element.hidden = false;
    const { current } = this;
    if (paragraph.portrait !== null) {
      void artFrameUrl(this, paragraph.portrait)
        .then((url) => {
          if (this.current === current && this.view === view) {
            panel.portrait.src = url;
            panel.portrait.hidden = false;
          }
        })
        .catch((error: unknown) => console.warn("The bark portrait failed to load", error));
    }
  }
}
