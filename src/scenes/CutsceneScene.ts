import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { Scene } from "phaser";

import { ZONE_MAP } from "../data/map.ts";
import { STAGE_PREVIEWS } from "../data/stagePreviews.ts";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text.ts";
import { deathLabels, deathSummary } from "../presentation/index.ts";
import {
  formatRunStats,
  type RunStatsSummary,
  type WholeRunDisplaySummary,
  type ZoneStatsSummary,
} from "../progress/index.ts";
import {
  createStageSummary,
  focusKeyAction,
  pauseKey,
  runStatLabels,
  STAGE_METRICS,
  type StageSummaryView,
  type StageSummaryWords,
  statsStatement,
  statsTotalRows,
} from "../ui/index.ts";
import { followTaps } from "./domTaps.ts";
import { artFrameUrl, conversationControls, mountSceneView, sceneDomUi } from "./domUi.ts";
import { modalInput } from "./modalInput.ts";

export interface CutsceneData {
  readonly percent: number;
  readonly stage: string;
  readonly clearedStage: string;
  readonly cleared?: boolean;
  readonly runStats: RunStatsSummary;
  readonly zoneStats: ZoneStatsSummary;
  readonly wholeRun: WholeRunDisplaySummary;
}

// The summary's words for data: the cleared stage's zone, number, name and progress, its metrics
// and the stage, zone and run totals, and the antagonist's clear statement unless the stage was
// turned back from.
export function stageSummaryWords(data: CutsceneData): StageSummaryWords {
  const identity = deathSummary(TEXT.death, {
    ...deathLabels(ZONE_MAP, TEXT.map, data.clearedStage, data.clearedStage),
    activeSeconds: data.runStats.attemptSeconds,
    percent: data.percent,
  });
  const values = formatRunStats(
    { ...TEXT.stats, attempts: "{count}", best: "{time}", lastAttempt: "{time}" },
    data.runStats,
  );
  const labels = runStatLabels(TEXT.stats);
  const statement = data.cleared === false ? undefined : statsStatement("clear", data.clearedStage);
  return {
    continue: TEXT.map.continue,
    progress: identity.progress,
    stage: identity.stage,
    ...(statement && {
      statement: { colour: statement.colour, name: statement.name, text: statement.text },
    }),
    stats: STAGE_METRICS.map((key) => ({ label: labels[key], value: values[key] })),
    totals: statsTotalRows(
      { ...STATS_SCOPE_TEXT, runTotal: TEXT.stats.runTotal },
      {
        runSeconds: data.wholeRun.activeSeconds,
        stageSeconds: data.runStats.cumulativeSeconds ?? data.runStats.runSeconds,
        zoneSeconds: data.zoneStats.cumulativeSeconds ?? data.zoneStats.runSeconds,
      },
    ),
    zone: identity.title,
  };
}

// A required inter-stage screen. Only a fresh Continue activation starts the next stage. The
// summary is HTML in the UI layer (src/ui/dom/stageSummary.ts), in its modal layer with the pause
// button kept live: a fresh tap on Continue or on the statement line continues (followTaps); Tab
// and the arrows put the keyboard's focus on Continue, and a fresh Enter or Space continues
// wherever the focus is. P and Escape pass on to PauseScene, which opens its card over a
// departure; no other key, back or outside tap leaves it.
export class CutsceneScene extends Scene {
  private stage!: string;
  private summary!: CutsceneData;
  private finished = false;
  private closeModal: (() => void) | undefined;

  constructor(key = "cutscene") {
    super(key);
  }
  init(data: CutsceneData): void {
    this.stage = data.stage;
    this.summary = data;
    this.finished = false;
    this.closeModal = undefined;
  }
  create(): void {
    const preview = STAGE_PREVIEWS[this.summary.clearedStage];
    if (!preview || !this.textures.exists(preview)) {
      throw new Error(`Missing actual stage preview ${this.summary.clearedStage}`);
    }
    const view = createStageSummary(document, "stage-summary", stageSummaryWords(this.summary));
    const stops = [this.watchPresses(view), this.watchKeys(view)];
    let shown = true;
    this.events.once("shutdown", () => {
      shown = false;
      this.closeModal?.();
      this.closeModal = undefined;
      stops.forEach((stop) => stop());
    });
    void artFrameUrl(this, preview)
      .then((url) => {
        if (shown) {
          view.preview.src = url;
        }
      })
      .catch((error: unknown) => console.warn("The stage preview failed to load", error));
    mountSceneView(this, view.root);
    this.closeModal = sceneDomUi(this)?.modals.open(
      { live: conversationControls(this) },
      view.dialog,
    );
  }
  // Continue and the statement line continue on a fresh tap, Continue showing pressed meanwhile. A
  // click on Continue with no pointer behind it (an assistive technology's) continues.
  private watchPresses(view: StageSummaryView): () => void {
    const onClick = (event: MouseEvent) => {
      if (event.detail === 0 && modalInput(this).accepts()) {
        this.continue();
      }
    };
    view.continue.addEventListener("click", onClick);
    const stopTaps = followTaps(
      { preventDefault: true, target: view.root, view: view.root },
      modalInput(this),
      {
        accepts: () => !this.finished,
        controlAt: ({ target }) =>
          target instanceof Element && target.closest("[data-continue]") !== null
            ? "continue"
            : null,
        land: () => focusTarget(view.continue),
        show: (control) => view.continue.toggleAttribute("data-pressed", control !== undefined),
        tap: () => this.continue(),
      },
    );
    return () => {
      stopTaps();
      view.continue.removeEventListener("click", onClick);
    };
  }
  // The summary's keys, seen on its view before the modal layer and Phaser.
  private watchKeys(view: StageSummaryView): () => void {
    const onKeyDown = (event: KeyboardEvent) => {
      // P and Escape pass on to PauseScene, which opens its card over a departure as in play.
      if (pauseKey(event.key) || !modalInput(this).accepts(event)) {
        return;
      }
      event.stopPropagation();
      const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
      if (action === "next" || action === "previous") {
        event.preventDefault();
        view.continue.focus();
      } else if (action === "press") {
        event.preventDefault();
        this.continue();
      }
    };
    // Space would press Continue again as it lifts.
    const onKeyUp = (event: KeyboardEvent) => {
      if (!pauseKey(event.key)) {
        event.stopPropagation();
      }
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
  // Whether the pause card may open over this screen: Continue has not been activated.
  pausable(): boolean {
    return !this.finished;
  }
  private continue(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.closeModal?.();
    this.closeModal = undefined;
    this.finish();
  }
  protected finish(): void {
    this.scene.start("zone", { continueVisit: true, node: this.stage });
  }
}
