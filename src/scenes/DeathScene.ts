import { fillNames } from "@andornaut/game-kit/lines";
import { guardClicks } from "@andornaut/game-kit/web/ui/dom/domPress";
import { Scene } from "phaser";

import { STATS_SCOPE_TEXT, TEXT } from "../data/text.ts";
import { type DeathSummary, deathSummary } from "../presentation/index.ts";
import { formatRunStats, type RunStatsSummary } from "../progress/index.ts";
import {
  createDeathCard,
  DEATH_ACTIONS,
  type DeathAction,
  type DeathCardView,
  deathKeyAction,
  showPresses,
  STAGE_METRICS,
  statsStatement,
  statsTotalRows,
  type StatsTotalsSnapshot,
} from "../ui/index.ts";
import { mountSceneView, sceneDomUi } from "./domUi.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";

export interface DeathData extends DeathSummary {
  readonly totals: StatsTotalsSnapshot;
  readonly runStats: RunStatsSummary;
  readonly stage: string;
}
export interface DeathOpener {
  leaveDeath(): void;
  retryDeath(): void;
}

// Death's required card over the frozen zone, which the zone launches once his seated pose is
// reached: the zone, stage and progress, the antagonist's retry statement, the stage's metrics
// and totals, Back to title and Try again. It holds indefinitely, and only those two actions
// close it: back, Escape, P and a tap outside the card do nothing. The card is HTML in the UI
// layer (src/ui/dom/death.ts), shown once the dim of the zone under it is ready: a button acts
// when a press lands on it and lifts on it; Tab and the arrows move the keyboard's focus through
// Try again then Back to title, starting on the card itself, where Enter and Space press Try
// again (deathKeyAction), and Enter and Space press the focused button (the kit's modalLayer).
export class DeathScene extends Scene {
  private summary!: DeathData;
  private finished = false;
  private closeModal: (() => void) | undefined;

  constructor() {
    super("death");
  }

  init(data: DeathData): void {
    this.summary = data;
    this.finished = false;
    this.closeModal = undefined;
  }

  create(): void {
    const words = deathSummary(TEXT.death, this.summary);
    const values = formatRunStats(
      { ...TEXT.stats, attempts: "{count}", best: "{time}", lastAttempt: "{time}" },
      this.summary.runStats,
    );
    const statement = statsStatement("retry", this.summary.stage);
    const card: DeathCardView = createDeathCard(document, {
      actions: DEATH_ACTIONS.map((key) => ({
        key,
        label: key === "retry" ? TEXT.death.retry : TEXT.pause.home,
      })),
      label: fillNames(TEXT.death.label, { zone: this.summary.zoneLabel }),
      progress: words.progress,
      stage: words.stage,
      stats: STAGE_METRICS.map((key) => ({
        label: fillNames(TEXT.stats[key], { count: "", time: "" }).trimEnd(),
        value: values[key],
      })),
      ...(statement && { statement: statement.text }),
      title: words.title,
      totals: statsTotalRows(
        { ...STATS_SCOPE_TEXT, runTotal: TEXT.stats.runTotal },
        this.summary.totals,
      ),
    });
    card.root.hidden = true;
    for (const action of DEATH_ACTIONS) {
      card.buttons[action].addEventListener("click", () => this.act(action));
    }
    // A fresh Enter or Space with the focus on the card itself presses Try again; the modal layer
    // handles every other key.
    const onKeyDown = (event: KeyboardEvent) => {
      const action =
        event.target === card.dialog ? deathKeyAction(undefined, event).action : undefined;
      if (action !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        card.buttons[action].click();
      }
    };
    card.dialog.addEventListener("keydown", onKeyDown);
    const input = modalInput(this);
    const backdrop = showModalBackdrop(this);
    const stops = [
      guardClicks({ gate: input }, card.root),
      showPresses(() => input.accepts(), card.root),
      () => card.dialog.removeEventListener("keydown", onKeyDown),
    ];
    let shown = true;
    this.events.once("shutdown", () => {
      shown = false;
      this.closeModal?.();
      this.closeModal = undefined;
      stops.forEach((stop) => stop());
    });
    mountSceneView(this, card.root);
    void backdrop.ready.then(() => {
      if (shown && !this.finished) {
        card.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open({}, card.dialog);
      }
    });
  }

  private act(action: DeathAction): void {
    if (this.finished || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    this.finished = true;
    this.closeModal?.();
    this.closeModal = undefined;
    this.scene.stop();
    const opener = this.scene.get("zone") as unknown as DeathOpener;
    if (action === "retry") {
      opener.retryDeath();
    } else {
      opener.leaveDeath();
    }
  }
}
