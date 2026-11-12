import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { fillNames } from "@andornaut/game-kit/lines";
import { Scene } from "phaser";

import { ACHIEVEMENT_NOTICE_SECONDS, ACHIEVEMENT_NOTICE_SIDE } from "../data/achievements.ts";
import { TEXT } from "../data/text.ts";
import type { AchievementId } from "../data/types/index.ts";
import {
  createStatusPanel,
  onPanel,
  type PanelParagraph,
  showPanelParagraph,
  type StatusPanelView,
} from "../ui/index.ts";
import { ACHIEVEMENT_NOTICE, noticeBlocked } from "./achievementNotice.ts";
import { followTaps } from "./domTaps.ts";
import { artFrameUrl, mountSceneView } from "./domUi.ts";
import { modalInput } from "./modalInput.ts";
import { nextAchievementNotice } from "./save.ts";

const ICON = "icon-achievement";

// The frame of art's icon-achievement for id: its tag's first frame unlocked, its second locked.
// The tag is never played.
export function achievementIconFrame(
  scene: Scene,
  earned: boolean,
  id: AchievementId,
): string | number {
  const frames = sheetTags(scene.cache.json.get(ICON) as AsepriteSheet).get(id);
  const frame = frames?.[earned ? 0 : 1]?.frame;
  if (frame === undefined) {
    throw new Error(`No ${earned ? "unlocked" : "locked"} ${ICON} frame for ${id}`);
  }
  return frame;
}

// The notice as a dialogue paragraph without a name tab: the filled notice line as a bold first
// line and the achievement's description below it, beside the portrait frame, which shows the
// unlocked icon.
export function achievementNoticeParagraph(id: AchievementId): PanelParagraph {
  const entry = TEXT.achievements.entries[id];
  return {
    heading: fillNames(TEXT.achievements.notice, { title: entry.title }),
    name: null,
    side: ACHIEVEMENT_NOTICE_SIDE,
    text: entry.description,
  };
}

// Unlock notices, one at a time in the shared dialogue panel for ACHIEVEMENT_NOTICE_SECONDS, with no
// buttons and no modal input scope. Launched once at boot, it runs above play and below every
// modal card. A notice starts only while nothing defers it (noticeBlocked); while one shows, barks
// wait. Something that defers notices hides the one showing and holds its time until it ends. A
// fresh tap on the panel dismisses only the notice. A notice shows, and its time starts, once its
// icon's cut is ready (or has failed), so it never shows an empty portrait frame. The panel is
// HTML in the UI layer (src/ui/dom/dialogue.ts), a polite status region; it takes no presses
// itself, so the scene reads the tap from the page (followTaps) and the screen under it still
// takes the press.
export class AchievementNoticeScene extends Scene {
  private view: StatusPanelView | undefined;
  private notice: AchievementId | undefined;
  // Whether the showing notice's icon is ready, so it may show.
  private ready = false;
  private remaining = 0;

  constructor() {
    super(ACHIEVEMENT_NOTICE);
  }

  create(): void {
    this.notice = undefined;
    this.remaining = 0;
    const view = createStatusPanel(document, "achievement-notice");
    this.view = view;
    const stopTaps = this.watchInput(view);
    this.events.once("shutdown", () => {
      stopTaps();
      this.clear();
      this.view = undefined;
    });
    mountSceneView(this, view.root);
  }

  showing(): boolean {
    return this.notice !== undefined;
  }

  override update(_time: number, delta: number): void {
    const blocked = noticeBlocked(this);
    if (this.showing()) {
      const hidden = blocked || !this.ready;
      if (this.view !== undefined && this.view.panel.element.hidden !== hidden) {
        this.view.panel.element.hidden = hidden;
      }
      if (hidden) {
        return;
      }
      this.remaining -= delta;
      if (this.remaining > 0) {
        return;
      }
      this.clear();
    }
    const id = nextAchievementNotice(() => blocked);
    if (id !== undefined) {
      this.show(id);
    }
  }

  private show(id: AchievementId): void {
    this.notice = id;
    this.ready = false;
    this.remaining = ACHIEVEMENT_NOTICE_SECONDS * 1000;
    const view = this.view;
    if (view === undefined) {
      return;
    }
    const { panel } = view;
    showPanelParagraph(panel, achievementNoticeParagraph(id));
    panel.portrait.hidden = true;
    const shows = () => this.notice === id && this.view === view;
    void artFrameUrl(this, ICON, achievementIconFrame(this, true, id))
      .then((url) => {
        if (shows()) {
          panel.portrait.src = url;
          panel.portrait.hidden = false;
        }
      })
      .catch((error: unknown) => console.warn("The achievement icon failed to load", error))
      .finally(() => {
        if (shows()) {
          this.ready = true;
        }
      });
  }

  private clear(): void {
    this.notice = undefined;
    this.ready = false;
    this.remaining = 0;
    if (this.view !== undefined) {
      this.view.panel.element.hidden = true;
    }
  }

  // A fresh tap on the showing notice's panel, while nothing defers it, dismisses it, and never
  // the notice that replaced it meanwhile.
  private watchInput(view: StatusPanelView): () => void {
    let pressed: AchievementId | undefined;
    return followTaps(
      { preventDefault: false, target: document, view: view.root },
      modalInput(this),
      {
        accepts: () => this.showing() && !noticeBlocked(this),
        controlAt: ({ clientX, clientY }) =>
          onPanel(view.panel, clientX, clientY) ? "panel" : null,
        land: () => {
          pressed = this.notice;
        },
        tap: () => {
          if (this.notice === pressed) {
            this.clear();
          }
        },
      },
    );
  }
}
