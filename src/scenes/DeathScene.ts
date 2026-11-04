import { fillNames } from "@andornaut/game-kit/lines";
import { type GameObjects, type Input, Scene } from "phaser";

import { SCREEN } from "../data/screen";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import { type DeathSummary, deathSummary } from "../presentation";
import { formatRunStats, type RunStatsSummary } from "../progress";
import {
  DEATH_ACTIONS,
  type DeathAction,
  deathCard,
  deathKeyAction,
  type PressArea,
  pressedArea,
  RUN_STAT_KEYS,
  statsStatement,
  statsTotalRows,
  type StatsTotalsSnapshot,
} from "../ui";
import {
  addCardTextIn,
  addSlice,
  addTextButton,
  BODY_FONT,
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

export interface DeathData extends DeathSummary {
  readonly totals: StatsTotalsSnapshot;
  readonly runStats: RunStatsSummary;
  readonly stage: string;
}
export interface DeathOpener {
  leaveDeath(): void;
  retryDeath(): void;
}

// Death's required card holds indefinitely. Only an explicit title/retry action can close it.
export class DeathScene extends Scene {
  private summary!: DeathData;
  private layout!: ReturnType<typeof deathCard>;
  private buttons!: Readonly<Record<DeathAction, TextButton>>;
  private focus: DeathAction | undefined;
  private ring: GameObjects.NineSlice | undefined;
  private press:
    | {
        readonly at: { readonly x: number; readonly y: number };
        readonly id: number;
        readonly target: DeathAction | undefined;
        cancelled: boolean;
      }
    | undefined;
  private finished = false;

  constructor() {
    super("death");
  }
  init(data: DeathData): void {
    this.summary = data;
    this.focus = undefined;
    this.ring = undefined;
    this.press = undefined;
    this.finished = false;
  }
  create(): void {
    fitPlayCamera(this);
    const words = deathSummary(TEXT.death, this.summary);
    const values = formatRunStats(
      {
        ...TEXT.stats,
        attempts: "{count}",
        best: "{time}",
        lastAttempt: "{time}",
        runTotal: "{time}",
      },
      this.summary.runStats,
    );
    const statement = statsStatement("retry", this.summary.stage);
    this.layout = deathCard(
      cardFonts(this),
      { ...SCREEN, x: 0, y: 0 },
      {
        ...words,
        home: TEXT.pause.home,
        retry: TEXT.death.retry,
        ...(statement && { statement: statement.text }),
        stats: RUN_STAT_KEYS.map((key) => ({
          label: fillNames(TEXT.stats[key], { count: "", time: "" }).trimEnd(),
          value: values[key],
        })),
        totals: statsTotalRows(
          { ...STATS_SCOPE_TEXT, runTotal: TEXT.stats.runTotal },
          this.summary.totals,
        ),
      },
    );
    addSlice(this, "ui-settings-card", this.layout.card);
    for (const name of ["title", "stage", "progress"] as const) {
      addCardTextIn(
        this,
        name === "title" ? TITLE_FONT : BODY_FONT,
        this.layout[name],
        name === "title"
          ? this.layout.titleText
          : name === "stage"
            ? this.layout.stageText
            : words[name],
        paletteColour(this, "ink"),
      );
    }
    if (this.layout.statement) {
      addCardTextIn(
        this,
        BODY_FONT,
        this.layout.statement.rect,
        this.layout.statement.text,
        paletteColour(this, "ink"),
      ).setLeftAlign();
    }
    for (const row of this.layout.stats) {
      addCardTextIn(
        this,
        BODY_FONT,
        row.label.rect,
        row.label.text,
        paletteColour(this, "ink"),
      ).setLeftAlign();
      addCardTextIn(
        this,
        BODY_FONT,
        row.value.rect,
        row.value.text,
        paletteColour(this, "ink"),
      ).setRightAlign();
    }
    if (this.layout.divider) {
      const divider = this.layout.divider;
      this.add
        .rectangle(divider.x, divider.y, divider.width, divider.height, paletteColour(this, "ink"))
        .setOrigin(0);
    }
    this.buttons = {
      home: addTextButton(this, this.layout.home, TEXT.pause.home),
      retry: addTextButton(this, this.layout.retry, TEXT.death.retry, { style: PRIMARY_BUTTON }),
    };
    this.render();
    catchModalTaps(this, this.cameras.main, {
      covered: () => [this.layout.card, ...DEATH_ACTIONS.map((name) => this.layout[name].hit)],
    });
    this.watchInput();
    modalInput(this).subscribe(() => {
      this.press = undefined;
      this.render();
    });
    captureTab(this, true);
    this.events.once("shutdown", () => captureTab(this, false));
    showModalBackdrop(this);
  }
  private render(): void {
    for (const name of DEATH_ACTIONS) {
      pressTextButton(this.buttons[name], this.press?.target === name && !this.press.cancelled);
    }
    this.ring = ringFocus(
      this,
      this.ring,
      this.focus === undefined ? undefined : this.layout[this.focus].button,
    );
  }
  private areas(): readonly PressArea<DeathAction>[] {
    return DEATH_ACTIONS.map((key) => ({
      art: this.layout[key].button,
      hit: this.layout[key].hit,
      key,
    }));
  }
  private act(action: DeathAction): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.scene.stop();
    const opener = this.scene.get("zone") as unknown as DeathOpener;
    if (action === "retry") {
      opener.retryDeath();
    } else {
      opener.leaveDeath();
    }
  }
  private watchInput(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!modalInput(this).accepts(event)) {
        return;
      }
      event.stopPropagation();
      const next = deathKeyAction(this.focus, event);
      this.focus = next.focus;
      this.render();
      if (next.action !== undefined) {
        this.act(next.action);
      }
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => event.stopPropagation());
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.press || this.finished) {
        return;
      }
      const at = playPoint(this, pointer);
      this.press = { at, cancelled: false, id: pointer.id, target: pressedArea(this.areas(), at) };
      this.render();
    });
    onScenePointer(this, "pointermove", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      if (this.press?.id === pointer.id) {
        const at = playPoint(this, pointer);
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
      const at = playPoint(this, pointer);
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
  }
}
