import { Scene } from "phaser";

import { DIALOGUES, SPEAKERS } from "../data/dialogues.ts";
import { STAGE_PREVIEWS } from "../data/stagePreviews.ts";
import { TEXT } from "../data/text.ts";
import type { DialogueChoice } from "../data/types/index.ts";
import {
  createDialogueView,
  type DialogueAction,
  type DialogueControl,
  dialogueKeyAction,
  type DialogueParagraph,
  dialogueParagraphs,
  dialogueProgress,
  type DialogueView,
  pauseKey,
  showPanelParagraph,
  stepFocus,
} from "../ui/index.ts";
import type { DialogueChoiceData } from "./DialogueChoiceScene.ts";
import { followTaps } from "./domTaps.ts";
import { artFrameUrl, conversationControls, mountSceneView, sceneDomUi } from "./domUi.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";

export interface DialogueData {
  readonly scene: string;
  // The cleared stage of a zone's outgoing exchange: its actual preview fills the screen behind
  // the box, and Continue sits at the bottom right.
  readonly clearedStage?: string;
  readonly linear?: boolean;
  readonly opener?: string;
}

export interface DialogueOpener {
  dialogueClosed(selection?: string): void;
}

export interface DialogueChoiceOpener {
  choiceSelected(selection: string): void;
}

// The keyboard's focus order.
const CONTROLS: readonly DialogueControl[] = ["continue", "skip"];

// Where a press lands in the view: on Skip or Continue, or anywhere else ("panel"), which
// advances as Continue does.
type DialogueTarget = DialogueControl | "panel";

// ZoneScene owns the frozen world and per-attempt trigger. This scene owns one paragraph at a
// time, consuming input until the conversation and its optional required terminal choice finish.
// The conversation is HTML in the UI layer (src/ui/dom/dialogue.ts), opened in its modal layer
// with the pause button kept live: a fresh tap advances, anywhere but on Skip, which skips; Tab
// and the arrows move the keyboard's focus through Continue then Skip, wrapping, starting on
// neither; Enter and Space press the focused one, and every other key but P and Escape, which
// pass on to PauseScene, advances.
export class DialogueScene extends Scene implements DialogueChoiceOpener {
  private paragraphs: readonly DialogueParagraph[] = [];
  private opener = "zone";
  private paragraph = 0;
  private choice: DialogueChoice | undefined;
  private choosing = false;
  private finished = false;
  private clearedStage: string | undefined;
  private view: DialogueView | undefined;
  private closeModal: (() => void) | undefined;
  // Each portrait's cut, once it is ready.
  private portraits = new Map<string, string>();

  constructor() {
    super("dialogue");
  }

  init({ clearedStage, linear = false, opener = "zone", scene }: DialogueData): void {
    this.clearedStage = clearedStage;
    this.opener = opener;
    const plan = DIALOGUES[scene];
    if (!plan) {
      throw new Error(`No dialogue ${scene}`);
    }
    if ((clearedStage !== undefined || linear) && plan.choice) {
      throw new Error("Zone exchanges must remain skippable linear conversations");
    }
    this.paragraphs = dialogueParagraphs(SPEAKERS, TEXT, plan);
    this.choice = plan.choice;
    this.paragraph = 0;
    this.choosing = false;
    this.finished = false;
    this.view = undefined;
    this.closeModal = undefined;
    this.portraits = new Map();
  }

  create(): void {
    const words = TEXT.dialogue;
    if (!words.continue.trim() || !words.skip.trim()) {
      throw new Error("Dialogue actions need labels");
    }
    const departure = this.clearedStage !== undefined;
    const preview = departure ? STAGE_PREVIEWS[this.clearedStage!] : undefined;
    if (departure && (!preview || !this.textures.exists(preview))) {
      throw new Error(`Missing actual stage preview ${this.clearedStage}`);
    }
    for (const { portrait } of this.paragraphs) {
      if (portrait !== null && !this.textures.exists(portrait)) {
        throw new Error(`Missing dialogue portrait ${portrait}`);
      }
    }
    // Every portrait is cut up front, so a later paragraph's shows as it does.
    this.cutPortraits();
    const view = createDialogueView(document, departure, "dialogue", words);
    this.view = view;
    this.showParagraph();
    const stops = [this.watchPresses(view), this.watchKeys(view)];
    let shown = true;
    this.events.once("shutdown", () => {
      shown = false;
      this.closeModal?.();
      this.closeModal = undefined;
      stops.forEach((stop) => stop());
    });
    mountSceneView(this, view.root);
    const open = () => {
      if (shown && !this.finished) {
        view.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open(
          { live: conversationControls(this) },
          view.dialog,
        );
      }
    };
    if (preview === undefined) {
      open();
      showModalBackdrop(this);
      return;
    }
    // A departure shows once its preview can paint, so the paused zone never shows through.
    view.root.hidden = true;
    void artFrameUrl(this, preview)
      .then(async (url) => {
        view.preview.src = url;
        await view.preview.decode();
      })
      .catch((error: unknown) => console.warn("The stage preview failed to load", error))
      .finally(open);
  }

  // Whether the pause card may open over this conversation: it still shows a line. Its required
  // choice answers for itself.
  pausable(): boolean {
    return !this.finished && !this.choosing;
  }

  // The required choice calls once after its own scene stops; the world remains frozen until here.
  choiceSelected(selection: string): void {
    if (this.choosing) {
      this.finish(selection);
    }
  }

  // Cuts each paragraph's portrait, once per game, and keeps the cuts ready to show.
  private cutPortraits(): void {
    for (const key of new Set(this.paragraphs.flatMap(({ portrait }) => portrait ?? []))) {
      void artFrameUrl(this, key)
        .then((url) => this.portraits.set(key, url))
        .catch((error: unknown) => console.warn("The dialogue portrait failed to load", error));
    }
  }

  // Shows the current paragraph, its portrait as soon as its cut is ready.
  private showParagraph(): void {
    const view = this.view;
    const paragraph = this.paragraphs[this.paragraph];
    if (!paragraph) {
      throw new Error("Missing dialogue paragraph");
    }
    if (view === undefined) {
      return;
    }
    showPanelParagraph(view.panel, paragraph);
    const { portrait } = view.panel;
    const key = paragraph.portrait;
    const cut = key === null ? undefined : this.portraits.get(key);
    portrait.hidden = cut === undefined;
    if (cut !== undefined) {
      portrait.src = cut;
    } else if (key !== null) {
      const shownAt = this.paragraph;
      void artFrameUrl(this, key)
        .then((url) => {
          this.portraits.set(key, url);
          if (this.paragraph === shownAt && this.view === view) {
            portrait.src = url;
            portrait.hidden = false;
          }
        })
        .catch((error: unknown) => console.warn("The dialogue portrait failed to load", error));
    }
  }

  private finish(selection?: string): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.closeModal?.();
    this.closeModal = undefined;
    if (this.view !== undefined) {
      this.view.root.hidden = true;
    }
    this.scene.stop();
    (this.scene.get(this.opener) as unknown as DialogueOpener).dialogueClosed(selection);
  }

  private act(action: DialogueAction | undefined): void {
    if (this.finished || this.choosing || action === undefined) {
      return;
    }
    if (action === "nextFocus" || action === "previousFocus") {
      const next = stepFocus(CONTROLS, this.focus(), action === "nextFocus" ? "next" : "previous");
      if (next !== undefined) {
        this.view?.buttons[next].focus();
      }
      return;
    }
    const next = dialogueProgress(this.choice, this.paragraphs.length, this.paragraph, action);
    if (next.kind === "complete") {
      this.finish();
    } else if (next.kind === "choice") {
      this.choosing = true;
      if (this.view !== undefined) {
        this.view.footer.hidden = true;
      }
      this.scene.launch("dialogueChoice", { choice: next.choice } satisfies DialogueChoiceData);
      this.scene.pause();
    } else {
      this.paragraph = next.index;
      this.showParagraph();
    }
  }

  // The button the keyboard's focus is on, if any.
  private focus(): DialogueControl | undefined {
    const active = this.view?.root.ownerDocument.activeElement;
    return CONTROLS.find((control) => this.view?.buttons[control] === active);
  }

  // A press advances, or skips on Skip, as a fresh tap (followTaps), and focuses the button it
  // lands on, or the conversation off them. A click with no pointer behind it (an assistive
  // technology's) presses its button.
  private watchPresses(view: DialogueView): () => void {
    const input = modalInput(this);
    const live = () => !this.finished && !this.choosing;
    const stopTaps = followTaps<DialogueTarget>(
      { preventDefault: true, target: view.root, view: view.root },
      input,
      {
        accepts: live,
        controlAt: ({ target }) =>
          target instanceof Element && view.root.contains(target)
            ? ((target.closest<HTMLElement>("[data-control]")?.dataset.control as
                DialogueControl | undefined) ?? "panel")
            : null,
        land: (control) => (control === "panel" ? view.dialog : view.buttons[control]).focus(),
        show: (control) =>
          CONTROLS.forEach((name) =>
            view.buttons[name].toggleAttribute("data-pressed", name === control),
          ),
        tap: (control) => this.act(control === "skip" ? "skip" : "advance"),
      },
    );
    const onClick = (event: MouseEvent) => {
      const control = (event.target as Element | null)?.closest<HTMLElement>("[data-control]")
        ?.dataset.control;
      if (control !== undefined && event.detail === 0 && live() && input.accepts()) {
        this.act(control === "skip" ? "skip" : "advance");
      }
    };
    // Phaser handles a touch off the canvas unless its default is prevented.
    const keep = (event: Event) => event.preventDefault();
    view.root.addEventListener("click", onClick);
    view.root.addEventListener("touchstart", keep, { capture: true, passive: false });
    view.root.addEventListener("touchend", keep, { capture: true, passive: false });
    return () => {
      stopTaps();
      view.root.removeEventListener("click", onClick);
      view.root.removeEventListener("touchstart", keep, true);
      view.root.removeEventListener("touchend", keep, true);
    };
  }

  // The conversation's keys, seen on its view before the modal layer and Phaser: P and Escape
  // pass on to PauseScene, which opens its card over the conversation as in play; every other key
  // the modal input accepts stops here.
  private watchKeys(view: DialogueView): () => void {
    const onKeyDown = (event: KeyboardEvent) => {
      if (pauseKey(event.key) || !modalInput(this).accepts(event)) {
        return;
      }
      event.stopPropagation();
      const action = dialogueKeyAction(this.focus(), event);
      if (action !== undefined) {
        event.preventDefault();
        this.act(action);
      }
    };
    // Space would press the focused button again as it lifts.
    const onKeyUp = (event: KeyboardEvent) => {
      if (pauseKey(event.key)) {
        return;
      }
      event.stopPropagation();
      if (event.key === " ") {
        event.preventDefault();
      }
    };
    view.root.addEventListener("keydown", onKeyDown);
    view.root.addEventListener("keyup", onKeyUp);
    return () => {
      view.root.removeEventListener("keydown", onKeyDown);
      view.root.removeEventListener("keyup", onKeyUp);
    };
  }
}
