import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { fillNames } from "@andornaut/game-kit/lines";
import { guardClicks, listenOutsideTaps } from "@andornaut/game-kit/web/ui/dom/domPress";
import { Scene } from "phaser";

import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { SkillId } from "../data/types";
import { PHONE_EVENTS } from "../pwa";
import { createSkillDetailsCard, showPresses, SKILL_ART } from "../ui";
import { paletteColour } from "./cardParts";
import { artFrameUrl, mountSceneView, sceneDomUi } from "./domUi";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput } from "./modalInput";

export interface SkillDetailData {
  readonly onClose: () => void;
  readonly skill: SkillId;
}

// A skill's details over the paused zone, in Pause's place: its name, its ready disc and its
// description with the inline control illustrations. The card is HTML in the UI layer
// (src/ui/dom/skillDetails.ts), shown once the dim of the zone under it and the disc's glyph are
// ready. The close X (a press that lands and lifts on it), back, Escape, a tap outside the card,
// and Enter or Space with the focus on the card itself close it; P does not. Tab and the arrows
// move the keyboard's focus, which starts on the card, to the close X, and Enter and Space press
// it (the kit's modalLayer). Closing tells the opener once, after this scene's modal input
// closes, so the opener's own input accepts at once.
export class SkillDetailScene extends Scene {
  private detail!: SkillDetailData;
  private closed = false;
  private visit = 0;
  private ready = false;
  private closeModal: (() => void) | undefined;

  constructor() {
    super("skillDetail");
  }

  init(data: SkillDetailData): void {
    this.detail = data;
    this.visit++;
    this.closed = false;
    this.ready = false;
    this.closeModal = undefined;
  }

  create(): void {
    const visit = this.visit;
    const { skill } = this.detail;
    const words = TEXT.skills[skill];
    const colour = (name: string) => paletteColour(this, name);
    const card = createSkillDetailsCard(
      document,
      {
        cream: colour("cream"),
        ink: colour("ink"),
        navy: colour("navy"),
        white: colour("white"),
        yellow: colour("yellow"),
      },
      "skill-details-card",
      {
        actions: TEXT.buttons,
        close: TEXT.skillDetails.close,
        description: words.description,
        disc: fillNames(TEXT.skillDetails.disc, { skill: words.title }),
        icons: TEXT.actionIcons,
        title: words.title,
      },
    );
    card.root.hidden = true;
    card.close.addEventListener("click", () => this.requestClose());
    // A fresh Enter or Space with the focus on the card itself closes it, and P stops here,
    // before the modal layer and Phaser see it; the layer handles every other key.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "p" || event.key === "P") {
        event.stopPropagation();
      } else if (event.target === card.dialog && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) {
          this.requestClose();
        }
      }
    };
    card.dialog.addEventListener("keydown", onKeyDown);
    const art = SKILL_ART[skill];
    const ready = sheetTags(this.cache.json.get(art) as AsepriteSheet).get("ready")?.[0]?.frame;
    const glyph = artFrameUrl(this, art, ready, "ink").then(
      (url) => {
        card.glyph.src = url;
      },
      (error: unknown) => console.warn("The skill glyph failed to load", error),
    );
    const input = modalInput(this);
    const guard = { gate: input };
    const back = (event: Event) => {
      if (modalInput(this).accepts(event)) {
        event.stopImmediatePropagation();
        this.close();
      }
    };
    window.addEventListener(PHONE_EVENTS.backPressed, back, true);
    const stops = [
      guardClicks(guard, card.root),
      listenOutsideTaps(guard, TOUCH.tapMaxDistance, () => this.requestClose(), card.backdrop),
      showPresses(() => input.accepts(), card.root),
      () => card.dialog.removeEventListener("keydown", onKeyDown),
      () => window.removeEventListener(PHONE_EVENTS.backPressed, back, true),
    ];
    this.events.once("shutdown", () => {
      this.ready = false;
      this.closeModal?.();
      this.closeModal = undefined;
      stops.forEach((stop) => stop());
    });
    mountSceneView(this, card.root);
    const backdrop = showModalBackdrop(this);
    void Promise.all([backdrop.ready, glyph]).then(() => {
      if (this.visit === visit && !this.closed && this.sys.isActive()) {
        this.ready = true;
        card.root.hidden = false;
        this.closeModal = sceneDomUi(this)?.modals.open(
          { close: () => this.requestClose() },
          card.dialog,
        );
      }
    });
  }

  // A press, key or tap that closes the card, while the modal gate accepts.
  private requestClose(): void {
    if (modalInput(this).accepts()) {
      this.close();
    }
  }

  private close(): void {
    if (!this.ready || this.closed) {
      return;
    }
    this.closed = true;
    this.closeModal?.();
    this.closeModal = undefined;
    modalInput(this).close();
    this.scene.stop();
    this.detail.onClose();
  }
}
