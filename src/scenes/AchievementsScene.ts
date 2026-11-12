import { guardClicks, listenOutsideTaps } from "@andornaut/game-kit/web/ui/dom/domPress";
import { focusTargets } from "@andornaut/game-kit/web/ui/dom/modalLayer";
import { Scene } from "phaser";

import { TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import {
  type AchievementsCardView,
  achievementsPerPage,
  createAchievementsCard,
  showAchievementsPage,
  showPresses,
} from "../ui/index.ts";
import { achievementIconFrame } from "./AchievementNoticeScene.ts";
import { artFrameUrl, mountSceneView, sceneDomUi } from "./domUi.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";
import { achievementCard } from "./save.ts";

// The scene that opens the Achievements card: it passes the card back while the card shows, and
// hears when the card closes.
export interface AchievementsOpener {
  achievementsClosed(): void;
}

export interface AchievementsData {
  readonly opener: string;
}

type Target = "close" | "next" | "previous";
const TARGETS: readonly Target[] = ["close", "next", "previous"];
const ICON = "icon-achievement";

// The Achievements card over the scene that opened it: every achievement in tier order, none
// hidden, a page at a time with Previous, the page count and Next. An earned entry shows its
// unlocked icon frame and an ink title and description; a locked one its locked frame and both in
// grey, a no-death zone's current sequence beside its title. The close X, back, Escape, P and a
// tap outside close it. The card is HTML in the UI layer (src/ui/dom/achievements.ts), shown once
// the dim of the scenes under it and the entries' icons are ready: a control acts when a press
// lands on it and lifts on it; Tab and the arrows move the keyboard's focus, which starts on the
// card itself, through the enabled pager buttons and the close X, and Enter and Space press the
// focused one (the kit's modalLayer). Changing pages invalidates held presses, and moves the
// focus off a pager button the change disables to the first enabled control. The opener passes
// this scene back.
export class AchievementsScene extends Scene {
  private opener = "";
  private page = 0;
  private perPage = 1;
  private closed = false;
  private card: AchievementsCardView | undefined;
  private closeModal: (() => void) | undefined;

  constructor() {
    super("achievements");
  }

  init(data: AchievementsData): void {
    this.opener = data.opener;
    this.page = 0;
    this.closed = false;
    this.card = undefined;
    this.closeModal = undefined;
  }

  create(): void {
    const words = TEXT.achievements;
    const entries = achievementCard();
    this.perPage = achievementsPerPage();
    const card = createAchievementsCard(
      document,
      "achievements-card",
      { ...words, ...words.pages, title: words.cardTitle },
      entries.map(({ earned, id, progress }) => ({
        ...words.entries[id],
        earned,
        ...(progress && {
          progress: words.progress
            .replace("{have}", String(progress.have))
            .replace("{need}", String(progress.need)),
        }),
      })),
    );
    this.card = card;
    card.root.hidden = true;
    for (const target of TARGETS) {
      card.buttons[target].addEventListener("click", () => this.act(target));
    }
    this.render();
    const icons = Promise.all(
      entries.map(async ({ earned, id }, index) => {
        card.entries[index]!.icon.src = await artFrameUrl(
          this,
          ICON,
          achievementIconFrame(this, earned, id),
        );
      }),
    ).catch((error: unknown) => console.warn("The achievement icons failed to load", error));
    const input = modalInput(this);
    const backdrop = showModalBackdrop(this);
    const guard = { gate: input };
    const stops = [
      guardClicks(guard, card.root),
      listenOutsideTaps(guard, TOUCH.tapMaxDistance, () => this.back(), card.backdrop),
      showPresses(() => input.accepts(), card.root),
    ];
    let shown = true;
    this.events.once("shutdown", () => {
      shown = false;
      this.closeModal?.();
      this.closeModal = undefined;
      stops.forEach((stop) => stop());
    });
    mountSceneView(this, card.root);
    void Promise.all([backdrop.ready, icons]).then(() => {
      if (shown && !this.closed) {
        card.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open({ close: () => this.back() }, card.dialog);
      }
    });
  }

  // Back, Escape, P, the close X and a tap outside the card close it.
  back(): void {
    if (this.closed || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    this.closed = true;
    this.closeModal?.();
    this.closeModal = undefined;
    this.scene.stop();
    (this.scene.get(this.opener) as Scene & AchievementsOpener).achievementsClosed();
  }

  private act(target: Target): void {
    if (this.closed || !this.sys.isActive() || !modalInput(this).accepts()) {
      return;
    }
    if (target === "close") {
      this.back();
      return;
    }
    const page = this.page + (target === "next" ? 1 : -1);
    if (page < 0 || page * this.perPage >= (this.card?.entries.length ?? 0)) {
      return;
    }
    this.page = page;
    modalInput(this).invalidate();
    this.render();
  }

  // The current page, its count and the pager as the page leaves it.
  private render(): void {
    const card = this.card;
    if (card === undefined) {
      return;
    }
    const focused = card.root.ownerDocument.activeElement;
    const pages = Math.ceil(card.entries.length / this.perPage);
    showAchievementsPage(
      {
        countText: TEXT.achievements.pages.page
          .replace("{page}", String(this.page + 1))
          .replace("{pages}", String(pages)),
        page: this.page,
        perPage: this.perPage,
      },
      card,
    );
    if (focused instanceof HTMLButtonElement && focused.disabled) {
      focusTargets(card.dialog)[0]?.focus();
    }
  }
}
