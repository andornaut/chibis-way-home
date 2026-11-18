import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/runtime/art/aseprite";
import { fillNames } from "@andornaut/game-kit/runtime/lines";
import { Scene } from "phaser";

import { ACHIEVEMENT_NOTICE_SECONDS, ACHIEVEMENT_NOTICE_SIDE } from "../data/achievements.ts";
import { SPEAKERS } from "../data/dialogues.ts";
import { TEXT } from "../data/text.ts";
import type { AchievementId, SkillId } from "../data/types/index.ts";
import type { QueuedTip } from "../progress/index.ts";
import {
  createSkillActionHelp,
  createStatusPanel,
  onPanel,
  type PanelParagraph,
  showPanelParagraph,
  SKILL_ART,
  type StatusPanelView,
} from "../ui/index.ts";
import { ACHIEVEMENT_NOTICE, noticeBlocked, tipBlocked } from "./achievementNotice.ts";
import { bindSceneActions } from "./domTaps.ts";
import { artFrameUrl, mountSceneView } from "./domUi.ts";
import { modalInput } from "./modalInput.ts";
import { nextAchievementNotice, nextTip } from "./save.ts";
import { paletteColour } from "./scenePalette.ts";

const ICON = "icon-achievement";
// The SPEAKERS and TEXT.dialogue.speakers key every tip shows under.
export const TIP_SPEAKER = "tip";

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

// A tip as the Tip speaker's paragraph: the name tab in its colour, the portrait at its side,
// and the tip's text with inline control illustrations, its {skill} the granted skill's title and
// glyph. glyphs: each {skill} glyph, whose source the caller sets.
export function tipParagraph(
  document: Document,
  colours: Parameters<typeof createSkillActionHelp>[1],
  tip: QueuedTip,
): { readonly glyphs: readonly HTMLImageElement[]; readonly paragraph: PanelParagraph } {
  const speaker = SPEAKERS[TIP_SPEAKER];
  const name = TEXT.dialogue.speakers[TIP_SPEAKER];
  if (speaker === undefined || name === undefined) {
    throw new Error(`No ${TIP_SPEAKER} speaker`);
  }
  const { glyphs, nodes } = createSkillActionHelp(
    document,
    colours,
    { actions: TEXT.buttons, icons: TEXT.actionIcons },
    tip.id === "powerUp" ? TEXT.skills[tip.skill].title : undefined,
    TEXT.tips[tip.id],
  );
  return { glyphs, paragraph: { colour: speaker.colour, name, side: speaker.side, text: nodes } };
}

// A notice the panel shows: an unlock, or a first-time tip.
type Notice =
  | { readonly id: AchievementId; readonly kind: "achievement" }
  | { readonly kind: "tip"; readonly tip: QueuedTip };

// Unlock notices, one at a time in the shared dialogue panel for ACHIEVEMENT_NOTICE_SECONDS, with no
// buttons and no modal input scope, then each triggered tip for as long, in trigger order, behind
// every queued unlock. Launched once at boot, it runs above play and below every modal card, and
// never pauses play. A notice starts only while nothing defers it (noticeBlocked, and for a tip
// tipBlocked, so it shows only in play); while one shows, barks wait. Something that defers
// notices hides the one showing and holds its time until it ends. A fresh tap on the panel
// dismisses only the notice. A notice shows, and its time starts, once its icons' cuts are ready
// (or have failed), so it never shows an empty portrait frame or glyph.
// The panel is HTML in the UI layer (src/ui/dom/dialogue.ts), a polite status region whose panel
// names the notice's kind in data-notice; it takes no presses itself, so the scene reads the tap
// from the page (bindSceneActions) and the screen under it still takes the press.
export class AchievementNoticeScene extends Scene {
  private view: StatusPanelView | undefined;
  private notice: Notice | undefined;
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

  // Whether the showing notice, or an unlock about to start, must wait.
  private blocked(): boolean {
    return this.notice?.kind === "tip" ? tipBlocked(this) : noticeBlocked(this);
  }

  override update(_time: number, delta: number): void {
    const blocked = this.blocked();
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
      this.show({ id, kind: "achievement" });
      return;
    }
    const tip = nextTip(() => tipBlocked(this));
    if (tip !== undefined) {
      this.show({ kind: "tip", tip });
    }
  }

  private show(notice: Notice): void {
    this.notice = notice;
    this.ready = false;
    this.remaining = ACHIEVEMENT_NOTICE_SECONDS * 1000;
    const view = this.view;
    if (view === undefined) {
      return;
    }
    const { panel } = view;
    panel.element.dataset.notice = notice.kind;
    const { glyphs, paragraph } =
      notice.kind === "tip"
        ? tipParagraph(document, this.colours(), notice.tip)
        : { glyphs: [], paragraph: achievementNoticeParagraph(notice.id) };
    showPanelParagraph(panel, paragraph);
    panel.portrait.hidden = true;
    const shows = () => this.notice === notice && this.view === view;
    const portrait = this.portraitUrl(notice).then((url) => {
      if (shows() && url !== undefined) {
        panel.portrait.src = url;
        panel.portrait.hidden = false;
      }
    });
    const skill =
      notice.kind === "tip" && notice.tip.id === "powerUp" ? notice.tip.skill : undefined;
    const glyphCuts = glyphs.map((glyph) =>
      skill === undefined
        ? Promise.resolve()
        : this.glyphUrl(skill).then((url) => {
            if (shows()) {
              glyph.src = url;
            }
          }),
    );
    void Promise.allSettled([portrait, ...glyphCuts]).then((results) => {
      for (const result of results) {
        if (result.status === "rejected") {
          console.warn("The notice's icon failed to load", result.reason);
        }
      }
      if (shows()) {
        this.ready = true;
      }
    });
  }

  // The notice's portrait: the unlocked achievement's icon, or the Tip speaker's portrait.
  private async portraitUrl(notice: Notice): Promise<string | undefined> {
    if (notice.kind === "achievement") {
      return artFrameUrl(this, ICON, achievementIconFrame(this, true, notice.id));
    }
    const art = SPEAKERS[TIP_SPEAKER]?.portrait;
    return art === null || art === undefined ? undefined : artFrameUrl(this, art);
  }

  // A skill's ready glyph unfilled, cream as the panel's text.
  private async glyphUrl(skill: SkillId): Promise<string> {
    const art = SKILL_ART[skill];
    const frame = sheetTags(this.cache.json.get(art) as AsepriteSheet).get("ready")?.[0]?.frame;
    return artFrameUrl(this, art, frame);
  }

  private colours(): Parameters<typeof tipParagraph>[1] {
    const colour = (name: string) => paletteColour(this, name);
    return {
      cream: colour("cream"),
      ink: colour("ink"),
      navy: colour("navy"),
      white: colour("white"),
    };
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
    let pressed: Notice | undefined;
    return bindSceneActions<"panel">(
      { preventDefault: false, target: document, view: view.root },
      modalInput(this),
      {
        accepts: () => this.showing() && !this.blocked(),
        activate: () => {
          if (this.notice === pressed) {
            this.clear();
          }
        },
        controlAt: ({ clientX, clientY }) =>
          onPanel(view.panel, clientX, clientY) ? "panel" : null,
        controls: ["panel"],
        element: () => view.panel.element,
        identity: () => this.notice,
        land: () => {
          pressed = this.notice;
        },
      },
    );
  }
}
