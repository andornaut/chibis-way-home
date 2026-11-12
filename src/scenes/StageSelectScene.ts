import { guardClicks, listenOutsideTaps } from "@andornaut/game-kit/web/ui/dom/domPress";
import { Scene } from "phaser";

import { ZONE_MAP } from "../data/map.ts";
import { STAGE_PREVIEWS } from "../data/stagePreviews.ts";
import { TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import { RECIPES } from "../data/zones.ts";
import { destinationOf, destinationSelection, openMap } from "../progress/index.ts";
import {
  createStageSelect,
  focusKeyAction,
  reducedMotion,
  refuseControl,
  showPresses,
  type StageFace,
  stagePageOf,
  stagePickerKey,
  STAGES_PER_PAGE,
  type StageSelectView,
} from "../ui/index.ts";
import { artFrameUrl, mountSceneView, sceneDomUi } from "./domUi.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";
import { savedMap } from "./save.ts";

export interface StageSelectData {
  readonly destination: string;
}
export interface StageSelectOpener {
  stageSelected(stage: string): void;
  stageSelectionClosed(): void;
}

type PageKey = "previousPage" | "nextPage";
type Target =
  | { readonly kind: "stage"; readonly id: string }
  | { readonly kind: "close" }
  | { readonly kind: "page"; readonly step: -1 | 1 };
const PLANS = new Set(Object.keys(RECIPES));

// The stage picker over the map, for a destination with more than one unlocked stage: its
// catalogue's stages in fixed places, a page at a time, the latest unlocked one in art's primary
// button. A press that lands on a stage and lifts on it plays it; a locked stage stays shown,
// takes no focus and refuses with the refusal cue. Nothing starts focused: Tab or an arrow
// focuses the latest stage first, then steps through the unlocked stages (turning to their page),
// the page buttons that can turn and the close X; Enter and Space press the focused one. Escape,
// back, the close X and a tap outside the card close it. The card is HTML in the UI layer
// (src/ui/dom/stageSelect.ts), shown once the map's dim is ready.
export class StageSelectScene extends Scene {
  private stages: readonly string[] = [];
  private available: readonly string[] = [];
  private latest = "";
  private page = 0;
  private pages = 1;
  private destination = "";
  private focus: string | undefined;
  private finished = false;
  private refusals = new Set<() => void>();
  private view: StageSelectView | undefined;
  private closeModal: (() => void) | undefined;

  constructor() {
    super("stageSelect");
  }

  init({ destination }: StageSelectData): void {
    const progress = savedMap();
    const catalogue = destinationOf(ZONE_MAP, destination);
    const selection = destinationSelection(
      PLANS,
      ZONE_MAP,
      openMap(ZONE_MAP, new Set(progress.completed)),
      catalogue,
    );
    if (selection.kind !== "choose") {
      throw new Error(`Stage picker requires an unlocked stage: ${destination}`);
    }
    this.stages = catalogue.stages;
    this.available = selection.stages;
    this.latest = selection.latest;
    this.page = stagePageOf(this.stages, this.latest);
    this.pages = Math.ceil(this.stages.length / STAGES_PER_PAGE);
    this.destination = destination;
    this.focus = undefined;
    this.finished = false;
    this.refusals = new Set();
    this.view = undefined;
    this.closeModal = undefined;
  }

  create(): void {
    const title = TEXT.map.zones[this.destination];
    if (title === undefined) {
      throw new Error(`No destination label ${this.destination}`);
    }
    const view = createStageSelect(
      document,
      {
        close: TEXT.map.stageClose,
        locked: TEXT.map.stageLocked,
        pager: TEXT.map.stagePages,
        title,
      },
      STAGES_PER_PAGE,
      this.stages.map((id, index) => this.face(id, index)),
    );
    this.view = view;
    view.root.hidden = true;
    const previews = Promise.all(
      [...view.previews].map(async ([id, image]) => {
        image.src = await artFrameUrl(this, STAGE_PREVIEWS[id]!);
      }),
    ).catch((error: unknown) => console.warn("The stage screenshots failed to load", error));
    for (const [id, button] of view.stages) {
      button.addEventListener("click", () => this.activate({ id, kind: "stage" }));
    }
    view.close.addEventListener("click", () => this.activate({ kind: "close" }));
    view.pager?.previous.addEventListener("click", () => this.activate({ kind: "page", step: -1 }));
    view.pager?.next.addEventListener("click", () => this.activate({ kind: "page", step: 1 }));
    view.root.addEventListener("keydown", (event) => this.key(event));
    // A focused button presses on Space's keyup; the keydown already did.
    view.root.addEventListener("keyup", (event) => {
      if (event.key === " ") {
        event.preventDefault();
      }
    });
    const input = modalInput(this);
    const backdrop = showModalBackdrop(this);
    const guard = { gate: input };
    const stops = [
      guardClicks(guard, view.root),
      listenOutsideTaps(guard, TOUCH.tapMaxDistance, () => this.back(), view.backdrop),
      showPresses(() => input.accepts(), view.root),
    ];
    input.subscribe(() => {
      this.stopRefusals();
      this.releasePresses();
    });
    let shown = true;
    this.events.once("shutdown", () => {
      shown = false;
      this.stopRefusals();
      this.closeModal?.();
      this.closeModal = undefined;
      stops.forEach((stop) => stop());
    });
    mountSceneView(this, view.root);
    this.render();
    void Promise.all([backdrop.ready, previews]).then(() => {
      if (shown && !this.finished) {
        view.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open({}, view.dialog);
        this.render();
      }
    });
  }

  back(): void {
    if (!modalInput(this).accepts() || this.finished) {
      return;
    }
    this.finished = true;
    this.closeModal?.();
    this.closeModal = undefined;
    this.scene.stop();
    (this.scene.get("map") as unknown as StageSelectOpener).stageSelectionClosed();
  }

  private face(id: string, index: number): StageFace {
    const key = STAGE_PREVIEWS[id];
    if (key === undefined || !this.textures.exists(key)) {
      throw new Error(`No stage screenshot ${id}`);
    }
    return {
      id,
      look: !this.available.includes(id) ? "locked" : id === this.latest ? "primary" : "normal",
      name: TEXT.map.stages[id]!,
      number: TEXT.map.stageNumber.replace("{number}", String(index + 1)),
    };
  }

  private render(): void {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    view.pages.forEach((page, index) => {
      page.hidden = index !== this.page;
    });
    const enabled = this.pageKeys();
    for (const [key, button] of [
      ["previousPage", view.pager?.previous],
      ["nextPage", view.pager?.next],
    ] as const) {
      if (button === undefined) {
        continue;
      }
      if (enabled.includes(key)) {
        button.removeAttribute("aria-disabled");
        button.removeAttribute("tabindex");
      } else {
        // A page button with no page to turn to refuses a press, but the keys skip it.
        button.setAttribute("aria-disabled", "true");
        button.tabIndex = -1;
      }
    }
    if (view.count) {
      view.count.textContent = TEXT.map.stagePages.page
        .replace("{page}", String(this.page + 1))
        .replace("{pages}", String(this.pages));
    }
    if (this.closeModal === undefined) {
      return;
    }
    const focused =
      this.focus === undefined
        ? view.dialog
        : this.focus === "close"
          ? view.close
          : this.focus === "previousPage"
            ? view.pager?.previous
            : this.focus === "nextPage"
              ? view.pager?.next
              : view.stages.get(this.focus);
    if (focused !== undefined && document.activeElement !== focused) {
      focused.focus();
    }
  }

  private key(event: KeyboardEvent): void {
    if (!modalInput(this).accepts(event)) {
      return;
    }
    if (event.key !== "Escape" && focusKeyAction(event.key, event.shiftKey, false) === undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const next = stagePickerKey(
      { focus: this.focus, latest: this.latest, pages: this.pageKeys(), stages: this.available },
      event,
    );
    this.focus = next.focus;
    if (next.focus !== undefined && this.stages.includes(next.focus)) {
      this.changePage(stagePageOf(this.stages, next.focus));
    }
    if (next.page !== undefined) {
      this.changePage(this.page + next.page);
    }
    this.render();
    if (next.close) {
      this.back();
    } else if (next.stage !== undefined) {
      this.activate({ id: next.stage, kind: "stage" });
    }
  }

  private activate(target: Target): void {
    if (target.kind === "close") {
      this.back();
      return;
    }
    if (this.finished || !modalInput(this).accepts()) {
      return;
    }
    if (target.kind === "page") {
      this.changePage(this.page + target.step);
      return;
    }
    if (!this.visibleStages().includes(target.id)) {
      return;
    }
    if (!this.available.includes(target.id)) {
      this.refuse(this.view?.stages.get(target.id));
      return;
    }
    this.finished = true;
    this.closeModal?.();
    this.closeModal = undefined;
    this.scene.stop();
    (this.scene.get("map") as unknown as StageSelectOpener).stageSelected(target.id);
  }

  private refuse(control: HTMLElement | undefined): void {
    if (control !== undefined) {
      this.refusals.add(refuseControl(reducedMotion(window), control));
    }
  }

  private stopRefusals(): void {
    this.refusals.forEach((stop) => stop());
    this.refusals.clear();
  }

  // Shows no control pressed, for a press the modal stack or a page turn has voided.
  private releasePresses(): void {
    this.view?.root.querySelectorAll<HTMLElement>("[data-pressed]").forEach((control) => {
      delete control.dataset.pressed;
    });
  }

  private visibleStages(): readonly string[] {
    return this.stages.slice(this.page * STAGES_PER_PAGE, (this.page + 1) * STAGES_PER_PAGE);
  }

  private pageKeys(): PageKey[] {
    return [
      ...(this.page > 0 ? ["previousPage" as const] : []),
      ...(this.page + 1 < this.pages ? ["nextPage" as const] : []),
    ];
  }

  private changePage(page: number): void {
    if (page === this.page || !modalInput(this).accepts()) {
      return;
    }
    if (page < 0 || page >= this.pages) {
      this.refuse(page < 0 ? this.view?.pager?.previous : this.view?.pager?.next);
      return;
    }
    this.stopRefusals();
    this.releasePresses();
    this.page = page;
    if (this.focus !== undefined && !this.visibleStages().includes(this.focus)) {
      this.focus = this.visibleStages().find((id) => this.available.includes(id));
    }
    modalInput(this).invalidate();
    this.render();
  }
}
