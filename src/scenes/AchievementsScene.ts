import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { type GameObjects, type Input, Scene } from "phaser";

import { TEXT } from "../data/text";
import type { AchievementEntry } from "../progress";
import {
  achievementsCardLayout,
  cardTextOrigin,
  focusKeyAction,
  type PressArea,
  pressedArea,
  stepFocus,
} from "../ui";
import { achievementIconFrame } from "./AchievementNoticeScene";
import {
  addCardHeading,
  addCardText,
  addCardTextIn,
  addSlice,
  addTextButton,
  BODY_FONT,
  cardFonts,
  paletteColour,
  pressTextButton,
  ringFocus,
  setTextButtonEnabled,
  type TextButton,
  TITLE_FONT,
} from "./cardParts";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput, onScenePointer } from "./modalInput";
import { catchModalTaps } from "./modalTaps";
import { fitPlayCamera, playPoint } from "./playCamera";
import { achievementCard } from "./save";

// The scene that opens the Achievements card: it passes the card its keys and back while the card
// shows, and hears when the card closes.
export interface AchievementsOpener {
  achievementsClosed(): void;
}

export interface AchievementsData {
  readonly opener: string;
}

type Target = "close" | "next" | "previous";

// The Achievements card over the scene that opened it: every achievement in tier order, none
// hidden, a page at a time with Previous, the page count and Next. An earned entry shows its
// unlocked icon frame and an ink title and description; a locked one its locked frame and both in
// grey, a no-death zone's current sequence beside its title. The close X, back, Escape, P and a
// tap outside close it. Tab and the arrows move the keyboard's focus through Previous, Next and
// the close X, and Enter and Space press the focused one.
export class AchievementsScene extends Scene {
  private layout!: ReturnType<typeof achievementsCardLayout>;
  private entries: readonly AchievementEntry[] = [];
  private pageObjects: GameObjects.GameObject[][] = [];
  private pager!: Readonly<Record<"next" | "previous", TextButton>>;
  private pageCount!: GameObjects.BitmapText;
  private closeX!: GameObjects.Sprite;
  private opener = "";
  private page = 0;
  private closed = false;
  private focus: Target | undefined;
  private ring: GameObjects.NineSlice | undefined;
  private pressed: Target | undefined;

  constructor() {
    super("achievements");
  }

  init(data: AchievementsData): void {
    this.opener = data.opener;
    this.page = 0;
    this.closed = false;
    this.focus = undefined;
    this.ring = undefined;
    this.pressed = undefined;
    this.pageObjects = [];
  }

  create(): void {
    fitPlayCamera(this);
    const words = TEXT.achievements;
    this.entries = achievementCard();
    const shown = this.entries.map(({ id, progress }) => ({
      ...words.entries[id],
      ...(progress && {
        progress: words.progress
          .replace("{have}", String(progress.have))
          .replace("{need}", String(progress.need)),
      }),
    }));
    this.layout = achievementsCardLayout(
      cardFonts(this),
      { ...words.pages, title: words.cardTitle },
      shown,
    );
    const { card, close, pager, title } = this.layout;
    const ink = paletteColour(this, "ink");
    const grey = paletteColour(this, "grey");
    addSlice(this, "ui-settings-card", card);
    addCardHeading(this, title);
    this.entries.forEach((entry, index) => {
      const at = this.layout.entries[index]!;
      const text = shown[index]!;
      const colour = entry.earned ? ink : grey;
      const page = Math.floor(index / this.layout.perPage);
      const objects = [
        this.add
          .image(
            at.icon.x,
            at.icon.y,
            "icon-achievement",
            achievementIconFrame(this, entry.earned, entry.id),
          )
          .setOrigin(0),
        addCardText(this, TITLE_FONT, at.title, text.title, colour),
        ...at.description.map((line) => addCardText(this, BODY_FONT, line.at, line.text, colour)),
        ...(at.progress && text.progress !== undefined
          ? [addCardText(this, BODY_FONT, at.progress, text.progress, grey)]
          : []),
      ];
      (this.pageObjects[page] ??= []).push(...objects);
    });
    this.pager = {
      next: addTextButton(this, pager.next, words.pages.next),
      previous: addTextButton(this, pager.previous, words.pages.previous),
    };
    this.pageCount = addCardTextIn(this, BODY_FONT, pager.count, this.pageText(), ink);
    this.closeX = this.add.sprite(close.at.x, close.at.y, "ui-close").setOrigin(0);
    this.render();
    catchModalTaps(this, this.cameras.main, {
      close: () => this.back(),
      covered: () => [card, close.hit, pager.next.hit, pager.previous.hit],
    });
    this.watchInput();
    modalInput(this).subscribe(() => {
      this.pressed = undefined;
      this.render();
    });
    showModalBackdrop(this);
  }

  // A key the opener passes on while the card shows.
  key(event: KeyboardEvent): void {
    if (this.closed || !this.sys.isActive() || !modalInput(this).accepts(event)) {
      return;
    }
    const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
    if (action === "close") {
      this.back();
    } else if (action === "press") {
      if (this.focus !== undefined) {
        this.act(this.focus);
      }
    } else if (action !== undefined) {
      this.focus = stepFocus(this.targets(), this.focus, action);
      this.render();
    }
  }

  // Back, Escape, P, the close X and a tap outside the card close it.
  back(): void {
    if (this.closed || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    this.closed = true;
    this.scene.stop();
    (this.scene.get(this.opener) as Scene & AchievementsOpener).achievementsClosed();
  }

  // The enabled controls, in focus order.
  private targets(): Target[] {
    return [
      ...(this.page > 0 ? ["previous" as const] : []),
      ...(this.page + 1 < this.layout.pages ? ["next" as const] : []),
      "close",
    ];
  }

  private act(target: Target): void {
    if (this.closed || !modalInput(this).accepts()) {
      return;
    }
    if (target === "close") {
      this.back();
      return;
    }
    const page = this.page + (target === "next" ? 1 : -1);
    if (page < 0 || page >= this.layout.pages) {
      return;
    }
    this.page = page;
    this.pressed = undefined;
    if (this.focus !== undefined && !this.targets().includes(this.focus)) {
      this.focus = this.targets()[0];
    }
    modalInput(this).invalidate();
    this.render();
  }

  private targetAt(pointer: Input.Pointer): Target | undefined {
    const { close, pager } = this.layout;
    const areas: PressArea<Target>[] = [
      { art: close.art, hit: close.hit, key: "close" },
      ...(["next", "previous"] as const)
        .filter((key) => this.targets().includes(key))
        .map((key) => ({ art: pager[key].button, hit: pager[key].hit, key })),
    ];
    return pressedArea(areas, playPoint(this, pointer));
  }

  private watchInput(): void {
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.pressed = this.targetAt(pointer);
      this.render();
    });
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => {
      const target = this.pressed;
      this.pressed = undefined;
      this.render();
      if (!pointer.wasCanceled && target !== undefined && target === this.targetAt(pointer)) {
        this.act(target);
      }
    });
  }

  private pageText(): string {
    return TEXT.achievements.pages.page
      .replace("{page}", String(this.page + 1))
      .replace("{pages}", String(this.layout.pages));
  }

  // The current page's entries, the pager as the page leaves it, and the focus ring.
  private render(): void {
    this.pageObjects.forEach((objects, page) => {
      for (const object of objects) {
        (object as GameObjects.Components.Visible & GameObjects.GameObject).setVisible(
          page === this.page,
        );
      }
    });
    for (const key of ["next", "previous"] as const) {
      const button = this.pager[key];
      setTextButtonEnabled(this, this.targets().includes(key), button);
      pressTextButton(button, this.pressed === key);
    }
    const text = this.pageText();
    const origin = cardTextOrigin(cardFonts(this).body, this.layout.pager.count, text);
    this.pageCount.setText(text).setPosition(origin.x, origin.y);
    this.closeX.play(animationKey("ui-close", this.pressed === "close" ? "pressed" : "normal"));
    const { close, pager } = this.layout;
    this.ring = ringFocus(
      this,
      this.ring,
      this.focus === undefined
        ? undefined
        : this.focus === "close"
          ? close.art
          : pager[this.focus].button,
    );
  }
}
