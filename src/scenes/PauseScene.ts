import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { listenOutsideTaps } from "@andornaut/game-kit/web/ui/dom/domPress";
import { readUnit } from "@andornaut/game-kit/web/ui/dom/viewUnits";
import { Core, Scene } from "phaser";

import { EDGE } from "../core";
import { SKILL_GESTURE } from "../data/skills";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { SkillId } from "../data/types";
import { developmentSkillOverrides } from "../dev/mode";
import { SKILL_IDS, skillEnabled } from "../progress";
import { coverZone, PHONE_EVENTS, startWakeLock, stopWakeLock, zoneShown } from "../pwa";
import {
  type CardAction,
  cardBackAction,
  cardKeyAction,
  cardTurnAction,
  coarsePointer,
  createPauseView,
  focusKeyAction,
  type PauseColours,
  type PauseView,
  setTouchSettingShown,
  showPauseDisc,
  showPresses,
  showSkillButton,
  SKILL_ART,
  skillHud,
  type TouchSetting,
  touchSettings,
} from "../ui";
import { FRAME_TURN } from "../ui/input/frameTurn";
import { paletteColour } from "./cardParts";
import { artFrameUrl, mountSceneView, sceneDomUi } from "./domUi";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput, type SceneInput } from "./modalInput";
import { type PauseDiscTimeline, pauseDiscTimeline, playPauseDiscPress } from "./pauseChrome";
import { activeSkill, savedSkills, selectActiveSkill } from "./save";
import type { SettingsData, SettingsOpener, SettingsScene } from "./SettingsScene";
import type { SkillDetailData } from "./SkillDetailScene";
import type { ZoneScene } from "./ZoneScene";

// The scenes that show a conversation over the paused zone, each holding its modal input in turn:
// a line, the line's required choice, and the departure.
const CONVERSATIONS = ["dialogue", "dialogueChoice", "zoneDeparture"] as const;
type Conversation = (typeof CONVERSATIONS)[number];
const ZONE = "zone";
const SETTINGS = "settings";
const START = "start";
// The dimmed zone with each mix of the touch settings, so the settings card's Move controls and
// Action buttons rows update the view behind the card as they change.
const DIM_MIXES: readonly Readonly<Record<TouchSetting, boolean>>[] = [false, true].flatMap(
  (moveControls) => [false, true].map((actionButtons) => ({ actionButtons, moveControls })),
);

// The texture key of the dimmed zone with settings.
function dimTexture({ actionButtons, moveControls }: Readonly<Record<TouchSetting, boolean>>) {
  return `pause-dim-move-${String(moveControls)}-action-${String(actionButtons)}`;
}

// A conversation scene says whether it still waits for the player, so the card may open over it.
interface PausableConversation {
  pausable(): boolean;
}

// The press a pointer holds on a control, from where and when it landed; a refused one travelled
// too far or left the control, and acts on nothing.
interface ControlPress {
  readonly check: () => boolean;
  readonly control: HTMLButtonElement;
  readonly pointerId: number;
  refused: boolean;
  readonly startedAt: number;
  readonly x: number;
  readonly y: number;
}

// The pause card over the dimmed zone, and the pause button that opens it, which shows on a
// touch screen while a zone plays or a conversation covers it, never on the map. It runs beside
// the zone from the start. The button, P, Escape, back and a frame turn open the card in play
// and over a conversation's line, required choice or departure; opening it pauses the zone, or
// the conversation scene over the paused zone, which keeps its line or choice and its focus, and
// lets the screen sleep. Resume (the primary button, at the top), the close X, back, Escape, P
// and a tap outside the card close it. The skill buttons show over such a conversation too,
// taking no presses, so a tap on one reaches the conversation as any other tap does.
// Settings opens SettingsScene's card over the same dim in the pause card's place, and passes it
// back until it closes; Back to title ends the zone for the start screen.
// The card, the pause button and the skill HUD are HTML in the UI layer (src/ui/dom/pause.ts):
// a control acts when a press lands on it and lifts on it without travelling past the tap
// distance (watchPresses). Under the card the HUD stays live (the kit's modalLayer live elements): Tab and the
// arrows step the keyboard's focus through Resume, Settings, Back to title, the shown skills and
// the close X, and Enter and Space press the focused one. In play the pause button and the skill
// buttons are left out of the focus order, so Space and Enter stay the game's.
export class PauseScene extends Scene implements SettingsOpener {
  private skillVisit = 0;
  private view: PauseView | undefined;
  private colours!: PauseColours;
  private timeline!: PauseDiscTimeline;
  private dims = new Map<string, ReturnType<typeof showModalBackdrop>>();
  private state: "closed" | "open" | "opening" | "settings" | "skill" = "closed";
  // The conversation scene the card opened over, which it paused in the zone's place.
  private overConversation: Conversation | undefined;
  private closeModal: (() => void) | undefined;
  // The card control the keyboard's focus was on when Settings opened.
  private settingsFocus: HTMLElement | undefined;
  private press: ControlPress | undefined;
  private stopPausePress: (() => void) | undefined;
  // Each skill glyph's ready and muted sources, once cut.
  private glyphs = new Map<SkillId, { readonly muted: string; readonly ready: string }>();
  // What each skill button last showed, so a frame writes only what changed.
  private shownSkills = new Map<SkillId, string>();

  constructor() {
    super("pause");
  }

  create(): void {
    this.state = "closed";
    this.overConversation = undefined;
    this.dims = new Map();
    this.shownSkills = new Map();
    const colour = (name: string) => paletteColour(this, name);
    this.colours = {
      cream: colour("cream"),
      dslate: colour("dslate"),
      ink: colour("ink"),
      navy: colour("navy"),
      white: colour("white"),
      yellow: colour("yellow"),
    };
    this.timeline = pauseDiscTimeline(this.cache.json.get("ui-pause") as AsepriteSheet);
    const words = TEXT.pause;
    const view = createPauseView(document, this.colours, "pause-card", {
      button: words.button,
      card: words,
      ready: TEXT.skillHud.ready,
      recharging: TEXT.skillHud.recharging,
      skills: Object.fromEntries(
        SKILL_IDS.map((skill) => [skill, TEXT.skills[skill].title]),
      ) as Record<SkillId, string>,
    });
    this.view = view;
    this.watchPresses(view);
    modalInput(this).subscribe(() => {
      this.press = undefined;
      this.releasePauseButton();
    });
    this.watchKeys(view);
    this.watchBackAndTurns();
    this.loadGlyphs();
    this.events.once("shutdown", () => {
      this.press = undefined;
      this.releasePauseButton();
      this.closeModal?.();
      this.closeModal = undefined;
      if (this.state === "skill") {
        this.state = "closed";
        this.scene.stop("skillDetail");
        coverZone("pauseCard", false);
      }
    });
    mountSceneView(this, view.root);
    startWakeLock();
    // The zone's first frame: the game page is now the home screen.
    this.game.events.once(Core.Events.POST_RENDER, () => zoneShown());
  }

  // Cuts each skill's ready glyph, filled with ink as the canvas's fill tint draws it, and its
  // muted one.
  private loadGlyphs(): void {
    for (const skill of SKILL_IDS) {
      const art = SKILL_ART[skill];
      const tags = sheetTags(this.cache.json.get(art) as AsepriteSheet);
      const frame = (tag: string) => tags.get(tag)?.[0]?.frame;
      Promise.all([
        artFrameUrl(this, art, frame("ready"), "ink"),
        artFrameUrl(this, art, frame("muted")),
      ])
        .then(([ready, muted]) => {
          this.glyphs.set(skill, { muted, ready });
          this.shownSkills.delete(skill);
        })
        .catch((error: unknown) => console.warn("The skill glyphs failed to load", error));
    }
  }

  // Back opens or closes the card, as the keys do, and the page frame turning opens it.
  private watchBackAndTurns(): void {
    const onBack = (event: Event) => {
      if (this.blocked()) {
        return;
      }
      if (this.state === "settings") {
        const card = this.settings();
        if (modalInput(card).accepts(event)) {
          card.back();
        }
      } else if (this.cardInput().accepts(event)) {
        this.act(cardBackAction(this.state === "open"));
      }
    };
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    // The page frame turning mid-play or mid-conversation pauses it, as P does.
    const stopTurns = FRAME_TURN.onChange(() => this.act(cardTurnAction(this.state !== "closed")));
    this.events.once("shutdown", () => {
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack);
      stopTurns();
    });
  }

  private act(action: CardAction | undefined): void {
    if (this.blocked() || !this.cardInput().accepts()) {
      return;
    }
    if (action === "open") {
      void this.open();
    } else if (action === "close") {
      this.close();
    }
  }

  // Cache a shared-kit backdrop for each touch setting mix before showing the pause card.
  private async open(): Promise<void> {
    const conversation = this.pausableConversation();
    if (this.state !== "closed" || !(this.zonePlaying() || conversation !== undefined)) {
      return;
    }
    this.state = "opening";
    this.overConversation = conversation;
    modalInput(this).open();
    this.releasePauseButton();
    this.scene.pause(this.held());
    stopWakeLock();
    coverZone("pauseCard", true);
    this.showControls();

    const zone = this.scene.get(ZONE) as ZoneScene;
    for (const mix of DIM_MIXES) {
      zone.showTouchControls(mix);
      // eslint-disable-next-line no-await-in-loop -- each mix needs its own rendered frame.
      await this.dimZone(dimTexture(mix));
      if (!this.sys.isActive()) {
        return;
      }
    }
    zone.showTouchControls(touchSettings());
    this.renderDim();
    this.state = "open";
    this.showCard(true);
  }

  private close(): void {
    if (this.state !== "open") {
      return;
    }
    this.state = "closed";
    modalInput(this).close();
    this.destroyDims();
    this.showCard(false);
    this.scene.resume(this.held());
    this.overConversation = undefined;
    startWakeLock();
    coverZone("pauseCard", false);
  }

  // The scene the card holds: the conversation scene it opened over, or else the zone.
  private held(): string {
    return this.overConversation ?? ZONE;
  }

  // Ends the zone and shows the start screen, this scene staying beside it for the next zone.
  private returnHome(): void {
    this.state = "closed";
    this.overConversation = undefined;
    modalInput(this).close();
    this.destroyDims();
    this.showCard(false);
    this.scene.stop(ZONE);
    this.scene.launch(START);
    startWakeLock();
    coverZone("pauseCard", false);
  }

  // Saves a touch setting and shows it in the zone and the dim behind the cards.
  setTouchSetting(setting: TouchSetting, shown: boolean): void {
    setTouchSettingShown(setting, shown);
    (this.scene.get(ZONE) as ZoneScene).showTouchControls(touchSettings());
    this.renderDim();
  }

  // Hides the pause card under the settings card, which SettingsScene draws over the dim.
  private openSettings(): void {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    this.state = "settings";
    const focused = document.activeElement;
    this.settingsFocus =
      focused instanceof HTMLElement && view.card.dialog.contains(focused) ? focused : undefined;
    view.card.root.hidden = true;
    this.scene.launch(SETTINGS, { opener: this.scene.key } satisfies SettingsData);
  }

  // The settings card has closed: the pause card shows again, the keyboard's focus where it was.
  settingsClosed(): void {
    const view = this.view;
    if (this.state !== "settings" || view === undefined) {
      return;
    }
    this.state = "open";
    view.card.root.hidden = false;
    (this.settingsFocus ?? view.card.dialog).focus();
    this.settingsFocus = undefined;
  }

  private settings(): SettingsScene {
    return this.scene.get(SETTINGS) as SettingsScene;
  }

  private enabledSkills(): readonly SkillId[] {
    const overrides = developmentSkillOverrides();
    const owned = savedSkills();
    return SKILL_IDS.filter((skill) => skillEnabled(overrides, owned, skill));
  }

  private openSkill(skill: SkillId): void {
    if (
      (this.state !== "closed" && this.state !== "open") ||
      this.playCovered() ||
      !this.enabledSkills().includes(skill) ||
      !modalInput(this).accepts()
    ) {
      return;
    }
    if (this.state === "closed" && !this.scene.isActive(ZONE)) {
      return;
    }
    this.state = "skill";
    const visit = ++this.skillVisit;
    modalInput(this).open();
    this.destroyDims();
    this.showCard(false);
    // Under the card the zone is already paused.
    if (this.scene.isActive(ZONE)) {
      this.scene.pause(ZONE);
    }
    stopWakeLock();
    coverZone("pauseCard", true);
    this.scene.launch("skillDetail", {
      onClose: () => {
        if (this.skillVisit === visit) {
          this.skillClosed();
        }
      },
      skill,
    } satisfies SkillDetailData);
  }

  private skillClosed(): void {
    if (this.state !== "skill") {
      return;
    }
    this.state = "closed";
    modalInput(this).close();
    coverZone("pauseCard", false);
    const zone = this.scene.get(ZONE) as ZoneScene;
    zone.resumeSkillPlay();
    if (!this.playCovered() && modalInput(this).accepts()) {
      this.scene.resume(ZONE);
      startWakeLock();
    }
  }

  private skillReady(skill: SkillId): boolean {
    const state = (this.scene.get(ZONE) as ZoneScene).skillState();
    if (state === undefined) {
      return false;
    }
    if (skill === "dash") {
      const dash = state.bird.dash;
      return (
        state.tuning.dash !== undefined &&
        (dash?.remainingSeconds ?? 0) <= EDGE &&
        (dash?.cooldownRemainingSeconds ?? 0) <= EDGE &&
        !dash?.airUsed
      );
    }
    return skill === "doubleJump"
      ? state.tuning.doubleJump === true && !state.bird.airJumpUsed
      : true;
  }

  // The skill buttons show while they take presses, and over a conversation the card may open
  // over, where they take none.
  private skillHudShown(): boolean {
    return this.skillHudLive() || this.openableConversation() !== undefined;
  }

  // Whether the skill buttons take presses: in play, and under the open pause card.
  private skillHudLive(): boolean {
    if (!modalInput(this).accepts() || this.playCovered()) {
      return false;
    }
    return this.state === "open"
      ? this.scene.isPaused(ZONE)
      : this.state === "closed" &&
          this.scene.isActive(ZONE) &&
          (this.scene.get(ZONE) as ZoneScene).skillState()?.shown === true;
  }

  // The pause button and the skill HUD as the state leaves them.
  private showControls(): void {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    const pauseShown =
      this.state === "closed" &&
      (this.zonePlaying() || this.pausableConversation() !== undefined) &&
      coarsePointer(window);
    if (view.pauseButton.hidden === pauseShown) {
      view.pauseButton.hidden = !pauseShown;
    }
    const live = this.skillHudLive();
    if (view.hud.hasAttribute("data-live") !== live) {
      view.hud.toggleAttribute("data-live", live);
    }
    const row = skillHud(this.enabledSkills());
    const shown = this.skillHudShown();
    const selected = activeSkill();
    const tabbable = live && this.state === "open";
    for (const skill of SKILL_IDS) {
      const at = shown ? row.get(skill) : undefined;
      const look = {
        ready: skill === selected && this.skillReady(skill),
        selected: skill === selected,
      };
      const glyph = this.glyphs.get(skill);
      const key = [at?.x, at?.y, glyph?.ready, look.ready, look.selected, tabbable].join();
      if (this.shownSkills.get(skill) === key) {
        continue;
      }
      this.shownSkills.set(skill, key);
      const button = view.skills[skill];
      showSkillButton(this.colours, view.readiness, { ...look, at, tabbable }, button);
      if (glyph !== undefined) {
        button.disc.glyph.src = look.ready ? glyph.ready : glyph.muted;
      }
    }
  }

  // A press held on a skill in play opens its details once held long enough, and then acts on
  // nothing more.
  private updateSkillHold(): void {
    const press = this.press;
    const skill = press?.control.dataset.skill as SkillId | undefined;
    if (
      !this.sys.isActive() ||
      press === undefined ||
      press.refused ||
      skill === undefined ||
      this.state !== "closed" ||
      !this.skillHudLive() ||
      this.time.now - press.startedAt < SKILL_GESTURE.holdMilliseconds
    ) {
      return;
    }
    this.press = undefined;
    this.openSkill(skill);
  }

  // The dim behind the cards, with the touch buttons as the setting shows them.
  private renderDim(): void {
    const key = dimTexture(touchSettings());
    this.dims.forEach((dim, name) => dim.setVisible(name === key));
  }

  private destroyDims(): void {
    this.dims.forEach((dim) => dim.destroy());
    this.dims.clear();
  }

  // Shows or hides the card in the UI layer's modal layer, the skill HUD live beside it.
  private showCard(open: boolean): void {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    this.dims.forEach((dim, name) => dim.setVisible(open && name === dimTexture(touchSettings())));
    view.card.root.hidden = !open;
    if (open) {
      this.closeModal ??= sceneDomUi(this)?.modals.open(
        { close: () => this.close(), live: [view.hud] },
        view.card.dialog,
      );
    } else {
      const close = this.closeModal;
      this.closeModal = undefined;
      close?.();
    }
    this.showControls();
  }

  private playCovered(): boolean {
    return (this.scene.get(ZONE) as ZoneScene).playCovered();
  }

  // Whether something other than this card's own conversation covers play.
  private covered(): boolean {
    return this.playCovered() && this.overConversation === undefined;
  }

  // The conversation scene the closed card may open over.
  private openableConversation(): Conversation | undefined {
    return this.state === "closed" ? this.pausableConversation() : undefined;
  }

  // Whether something the card may not open over covers play.
  private blocked(): boolean {
    return this.covered() && this.openableConversation() === undefined;
  }

  private zonePlaying(): boolean {
    return this.scene.isActive(ZONE) && !this.playCovered();
  }

  // The conversation scene over the paused zone that holds the modal input and still waits for
  // the player: a line, its required choice or the departure.
  private pausableConversation(): Conversation | undefined {
    if (!this.scene.isPaused(ZONE) || !(this.scene.get(ZONE) as ZoneScene).conversationCovers()) {
      return undefined;
    }
    return CONVERSATIONS.find((key) => {
      if (!this.scene.isActive(key)) {
        return false;
      }
      const scene = this.scene.get(key);
      return (scene as unknown as PausableConversation).pausable() && modalInput(scene).accepts();
    });
  }

  override update(): void {
    this.updateSkillHold();
    this.showControls();
  }

  // Capture the next rendered frame, with an opaque palette fallback when readback fails.
  private async dimZone(key: string): Promise<void> {
    this.dims.forEach((dim) => dim.setVisible(false));
    const dim = showModalBackdrop(this);
    this.dims.set(key, dim);
    await dim.ready;
    dim.setVisible(false);
  }

  // The modal input a press, key, back or frame turn here answers to: the card's own, or, while
  // the card is closed over a conversation scene that holds the input, that scene's, so they
  // open the card over it.
  private cardInput(): SceneInput {
    const conversation = this.openableConversation();
    return modalInput(conversation === undefined ? this : this.scene.get(conversation));
  }

  private releasePauseButton(): void {
    const stop = this.stopPausePress;
    this.stopPausePress = undefined;
    stop?.();
  }

  // A control acts when a press lands on it and lifts on it without travelling past the tap
  // distance or leaving it, under the modal input of the card or of the conversation it opens
  // over, captured when the press lands, so a press never crosses a stack change. One press is
  // followed at a time, by its own pointer: another finger held on the canvas leaves it alone, and
  // the browser need not make the tap a click. A click with no pointer behind it (Enter or Space)
  // acts while that input accepts. A tap on the backdrop closes the card.
  private watchPresses(view: PauseView): void {
    const document = view.root.ownerDocument;
    const gate = {
      accepts: () => !this.blocked() && this.cardInput().accepts(),
      capture: () => {
        const check = this.cardInput().capture();
        return () => !this.blocked() && check();
      },
    };
    const controlOf = (target: EventTarget | null) => {
      const control = target instanceof Element ? target.closest("button") : null;
      return control !== null && view.root.contains(control) ? control : undefined;
    };
    // The control under a pointer: its event's target, or what is at its point where a redraw
    // took the target out of the page.
    const controlAt = (event: PointerEvent) =>
      controlOf(
        event.target instanceof Node && !event.target.isConnected
          ? document.elementFromPoint(event.clientX, event.clientY)
          : event.target,
      );
    // A press on the view is the view's alone: Phaser handles a press off the canvas unless its
    // default is prevented, which also keeps the keyboard's focus where it is and holds back the
    // mouse events a press would send.
    const keep = (event: Event) => event.preventDefault();
    const onDown = (event: PointerEvent) => {
      keep(event);
      const { pointerId, target } = event;
      const control = controlOf(target);
      if (control === undefined || this.press !== undefined) {
        return;
      }
      if (target instanceof Element && target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
      if (!gate.accepts()) {
        return;
      }
      this.press = {
        check: gate.capture(),
        control,
        pointerId,
        refused: false,
        startedAt: this.time.now,
        x: event.clientX,
        y: event.clientY,
      };
      if (control === view.pauseButton) {
        this.stopPausePress = playPauseDiscPress(this.timeline, (pose) =>
          showPauseDisc(this.colours, pose, view.pauseButton),
        );
      }
    };
    const onMove = (event: PointerEvent) => {
      const press = this.press;
      if (press?.pointerId !== event.pointerId || press.refused) {
        return;
      }
      const travel = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (
        travel > TOUCH.tapMaxDistance * readUnit(view.root) ||
        controlAt(event) !== press.control
      ) {
        press.refused = true;
        this.releasePauseButton();
      }
    };
    const onEnd = (event: PointerEvent) => {
      const press = this.press;
      if (press?.pointerId !== event.pointerId) {
        return;
      }
      this.press = undefined;
      this.releasePauseButton();
      if (
        event.type === "pointerup" &&
        !press.refused &&
        controlAt(event) === press.control &&
        press.check()
      ) {
        this.activate(view, press.control, press.startedAt);
      }
    };
    const onClick = (event: MouseEvent) => {
      const control = controlOf(event.target);
      if (control !== undefined && event.detail === 0 && gate.accepts()) {
        this.activate(view, control, undefined);
      }
    };
    view.root.addEventListener("pointerdown", onDown, true);
    view.root.addEventListener("touchstart", keep, { capture: true, passive: false });
    view.root.addEventListener("touchend", keep, { capture: true, passive: false });
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onEnd, true);
    document.addEventListener("pointercancel", onEnd, true);
    view.root.addEventListener("click", onClick);
    const stops = [
      listenOutsideTaps({ gate }, TOUCH.tapMaxDistance, () => this.close(), view.card.backdrop),
      showPresses(() => gate.accepts(), view.card.root),
      () => view.root.removeEventListener("pointerdown", onDown, true),
      () => view.root.removeEventListener("touchstart", keep, true),
      () => view.root.removeEventListener("touchend", keep, true),
      () => document.removeEventListener("pointermove", onMove, true),
      () => document.removeEventListener("pointerup", onEnd, true),
      () => document.removeEventListener("pointercancel", onEnd, true),
      () => view.root.removeEventListener("click", onClick),
    ];
    this.events.once("shutdown", () => stops.forEach((stop) => stop()));
  }

  // A control's action: the pause button opens the card, and the card's controls act while it is
  // open. A skill under the card opens its details; in play a tap selects it, and a press held
  // long enough (since pressedAt, for a pointer's press) opens its details instead.
  private activate(
    view: PauseView,
    control: HTMLButtonElement,
    pressedAt: number | undefined,
  ): void {
    const { buttons, close } = view.card;
    const skill = control.dataset.skill as SkillId | undefined;
    if (control === view.pauseButton) {
      void this.open();
    } else if (control === close || control === buttons.resume) {
      this.close();
    } else if (control === buttons.settings && this.state === "open") {
      this.openSettings();
    } else if (control === buttons.home && this.state === "open") {
      this.returnHome();
    } else if (skill !== undefined && this.skillHudLive()) {
      if (
        this.state === "open" ||
        (pressedAt !== undefined && this.time.now - pressedAt >= SKILL_GESTURE.holdMilliseconds)
      ) {
        this.openSkill(skill);
      } else {
        selectActiveSkill(skill);
      }
    }
  }

  // P and Escape open the card in play and over a conversation; once it shows, the modal layer
  // takes the keyboard. On the card itself, before any control has the focus, the first step goes
  // to Resume, or back to the close X.
  private watchKeys(view: PauseView): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (this.state !== "closed" || this.blocked() || !this.cardInput().accepts(event)) {
        return;
      }
      this.act(cardKeyAction(false, event.key, event.repeat));
    });
    const { dialog } = view.card;
    const onKeyDown = (event: KeyboardEvent) => {
      const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
      if (event.target === dialog && (action === "next" || action === "previous")) {
        event.preventDefault();
        event.stopPropagation();
        (action === "next" ? view.card.buttons.resume : view.card.close).focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    this.events.once("shutdown", () => dialog.removeEventListener("keydown", onKeyDown));
  }
}
