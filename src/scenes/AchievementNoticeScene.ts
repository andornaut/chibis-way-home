import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { fillNames } from "@andornaut/game-kit/lines";
import { containsPoint } from "@andornaut/game-kit/rect";
import { type GameObjects, type Input, Scene } from "phaser";

import { ACHIEVEMENT_NOTICE_SECONDS } from "../data/achievements";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { AchievementId } from "../data/types";
import {
  achievementNoticeLayout,
  DIALOGUE_SCREEN,
  type DialoguePress,
  dialogueTapAction,
  moveDialoguePress,
} from "../ui";
import { ACHIEVEMENT_NOTICE, noticeBlocked } from "./achievementNotice";
import { addCardText, cardFonts, paletteColour, TITLE_FONT } from "./cardParts";
import { drawDialoguePanel } from "./dialoguePanel";
import { onScenePointer } from "./modalInput";
import { fitPlayCamera, playPoint } from "./playCamera";
import { nextAchievementNotice } from "./save";

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

// Unlock notices, one at a time in the shared dialogue panel for ACHIEVEMENT_NOTICE_SECONDS, with no
// buttons and no modal input scope. Launched once at boot, it runs above play and below every
// modal card. A notice starts only while nothing defers it (noticeBlocked); while one shows, barks
// wait. Something that defers notices hides the one showing and holds its time until it ends. A
// fresh tap on the panel dismisses only the notice.
export class AchievementNoticeScene extends Scene {
  private art: GameObjects.GameObject[] = [];
  private remaining = 0;
  private press: DialoguePress | undefined;

  constructor() {
    super(ACHIEVEMENT_NOTICE);
  }

  create(): void {
    fitPlayCamera(this);
    this.art = [];
    this.remaining = 0;
    this.press = undefined;
    this.watchInput();
    this.events.once("shutdown", () => this.clear());
  }

  showing(): boolean {
    return this.art.length > 0;
  }

  override update(_time: number, delta: number): void {
    const blocked = noticeBlocked(this);
    if (this.showing()) {
      for (const object of this.art) {
        (object as GameObjects.Components.Visible & GameObjects.GameObject).setVisible(!blocked);
      }
      if (blocked) {
        this.press = undefined;
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
    const text = fillNames(TEXT.achievements.notice, {
      title: TEXT.achievements.entries[id].title,
    });
    const panel = DIALOGUE_SCREEN.box;
    const layout = achievementNoticeLayout(panel, cardFonts(this), text);
    this.art = [
      drawDialoguePanel(this),
      this.add
        .image(layout.icon.x, layout.icon.y, ICON, achievementIconFrame(this, true, id))
        .setOrigin(0)
        .setScale(layout.iconScale),
      addCardText(this, TITLE_FONT, layout.text, text, paletteColour(this, "cream")),
    ];
    this.remaining = ACHIEVEMENT_NOTICE_SECONDS * 1000;
  }

  private clear(): void {
    this.art.forEach((object) => object.destroy());
    this.art = [];
    this.remaining = 0;
    this.press = undefined;
  }

  private watchInput(): void {
    const controls = [
      { art: DIALOGUE_SCREEN.box, hit: DIALOGUE_SCREEN.box, key: "continue" as const },
    ];
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      const at = playPoint(this, pointer);
      if (
        this.press ||
        !this.showing() ||
        noticeBlocked(this) ||
        !containsPoint(DIALOGUE_SCREEN.box, at.x, at.y)
      ) {
        return;
      }
      this.input.stopPropagation();
      this.press = { at, cancelled: false, control: "continue", id: pointer.id };
    });
    onScenePointer(this, "pointermove", (pointer: Input.Pointer) => {
      if (this.press?.id === pointer.id) {
        this.input.stopPropagation();
        this.press = moveDialoguePress(TOUCH.tapMaxDistance, playPoint(this, pointer), this.press);
      }
    });
    const up = (pointer: Input.Pointer, outside: boolean) => {
      if (this.press?.id !== pointer.id) {
        return;
      }
      this.input.stopPropagation();
      const press = this.press;
      this.press = undefined;
      if (
        !outside &&
        this.showing() &&
        !noticeBlocked(this) &&
        dialogueTapAction(controls, TOUCH.tapMaxDistance, press, {
          ...playPoint(this, pointer),
          id: pointer.id,
          wasCanceled: pointer.wasCanceled,
        }) === "advance"
      ) {
        this.clear();
      }
    };
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => up(pointer, false));
    onScenePointer(this, "pointerupoutside", (pointer: Input.Pointer) => up(pointer, true));
  }
}
