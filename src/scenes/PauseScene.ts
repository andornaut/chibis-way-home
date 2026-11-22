import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/runtime/art/aseprite";
import type { HoldActionsBinding } from "@andornaut/game-kit/runtime/web/input/dom/holdActions";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { readUnit } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";
import { Scene } from "phaser";

import { EDGE } from "../core/index.ts";
import { SKILL_GESTURE } from "../data/skills.ts";
import { TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import type { SkillId } from "../data/types/index.ts";
import { developmentSkillOverrides } from "../dev/mode.ts";
import { SKILL_IDS, skillEnabled } from "../progress/index.ts";
import { PHONE_EVENTS, startWakeLock, stopWakeLock, updateOffer } from "../pwa/index.ts";
import {
  type CardAction,
  cardBackAction,
  cardKeyAction,
  cardTurnAction,
  createPauseView,
  focusKeyAction,
  type PauseColours,
  type PauseView,
  setTouchSettingShown,
  showPauseDisc,
  showPauseMenu,
  showSkillButton,
  SKILL_ART,
  skillHud,
  type TouchSetting,
  touchSettings,
} from "../ui/index.ts";
import { FRAME_TURN } from "../ui/input/frameTurn.ts";
import type { AchievementsOpener, AchievementsScene } from "./AchievementsScene.ts";
import { bindSceneActions, bindSceneButtons } from "./domTaps.ts";
import { artFrameUrl, sceneDomUi } from "./domUi.ts";
import { MENU_CONTENT_SCENES, menuContext, type MenuFrame } from "./menuContext.ts";
import { menuEntryFocus } from "./menuEntryFocus.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import {
  globalMenuInput,
  menuSourceReady,
  modalInput,
  type SceneInput,
  trackMenuActionBinding,
} from "./modalInput.ts";
import { type PauseDiscTimeline, pauseDiscTimeline, playPauseDiscPress } from "./pauseChrome.ts";
import { activeSkill, savedSkills, saveStand, selectActiveSkill } from "./save.ts";
import { paletteColour } from "./scenePalette.ts";
import type { SettingsData, SettingsOpener, SettingsScene } from "./SettingsScene.ts";
import type { SkillDetailData } from "./SkillDetailScene.ts";
import type { ZoneData, ZoneScene } from "./ZoneScene.ts";

// The scenes that show a conversation over the paused zone, each holding its modal input in turn:
// a line, the line's required choice, and the departure.
const CONVERSATIONS = ["dialogue", "dialogueChoice", "zoneDeparture"] as const;
// Frontmost content first; already-paused content never takes priority over active content.
const CONTENT_SCENES = [
  "dialogueChoice",
  "zoneDeparture",
  "dialogue",
  "cutscene",
  "death",
  "room",
  "celebration",
  "opening",
  "map",
  "zoneIntroduction",
  "zone",
  "start",
] as const;
// These required or browsing cards retain their own input guards.
const BLOCKING_CARDS = [
  "achievements",
  "death",
  "restart",
  "settings",
  "skillDetail",
  "stageSelect",
  "update",
] as const;
const ZONE = "zone";
const START = "start";
// A conversation scene says whether it still waits for the player, so the card may open over it.
interface PausableConversation {
  pausable(): boolean;
}

// One persistent entry opens Pause over active pausable content and Menu elsewhere.
// The entry respects the top modal owner. Each visit retains the underlying scopes,
// focus and already-paused scenes, and resumes only its own held subset when it closes.
// Settings and Achievements return to their originating shared card.
// The bottom primary action resumes Pause or closes Menu. The skill HUD keeps its existing
// play and conversation guards; no other control crosses the modal boundary.
export class PauseScene extends Scene implements AchievementsOpener, SettingsOpener {
  private skillVisit = 0;
  private menuGeneration = 0;
  private frames: MenuFrame[] = [];
  private mode: "menu" | "pause" = "pause";
  private homeShown = true;
  private returnEntryFocus = false;
  private waitingFor: string | undefined;
  private entryMode: "menu" | "pause" = "pause";
  private live = false;
  private view: PauseView | undefined;
  private colours!: PauseColours;
  private timeline!: PauseDiscTimeline;
  private dim: ReturnType<typeof showModalBackdrop> | undefined;
  private state: "achievements" | "closed" | "open" | "opening" | "settings" | "skill" = "closed";
  // The conversation scene the card opened over, which it paused in the zone's place.
  private overScene: string | undefined;
  private heldScenes: string[] = [];
  private closeModal: (() => void) | undefined;
  // The card control to restore after a nested card closes.
  private nestedFocus: HTMLElement | undefined;
  private actionBindings: HoldActionsBinding[] = [];
  private stopPausePress: (() => void) | undefined;
  // Each skill glyph's ready and muted sources, once cut.
  private glyphs = new Map<SkillId, { readonly muted: string; readonly ready: string }>();
  // What each skill button last showed, so a frame writes only what changed.
  private shownSkills = new Map<SkillId, string>();

  constructor() {
    super("pause");
  }

  create(): void {
    this.menuGeneration++;
    this.state = "closed";
    this.frames = [];
    this.returnEntryFocus = false;
    this.live = true;
    this.waitingFor = undefined;
    this.overScene = undefined;
    this.heldScenes = [];
    this.dim = undefined;
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
      card: { ...words, achievements: TEXT.start.achievements },
      ready: TEXT.skillHud.ready,
      recharging: TEXT.skillHud.recharging,
      skills: Object.fromEntries(
        SKILL_IDS.map((skill) => [skill, TEXT.skills[skill].title]),
      ) as Record<SkillId, string>,
    });
    this.view = view;
    const unmountEntry = sceneDomUi(this)?.menuEntry(view.pauseButton);
    this.events.once("shutdown", () => {
      this.live = false;
      this.menuGeneration++;
      unmountEntry?.();
    });
    // The delegated guard must see native clicks before the button renderer sees them.
    const entryRoot = view.pauseButton.parentElement ?? view.pauseButton;
    this.watchPresses(entryRoot, view);
    modalInput(this).subscribe(() => {
      this.cancelPresses();
      this.releasePauseButton();
      this.syncMenuVisibility();
    });
    this.watchKeys(view);
    this.watchBackAndTurns();
    this.loadGlyphs();
    this.events.once("shutdown", () => {
      this.cancelPresses();
      this.releasePauseButton();
      this.closeModal?.();
      this.closeModal = undefined;
      if (this.state === "skill") {
        this.state = "closed";
        this.scene.stop("skillDetail");
      }
    });
    // Pause owns the last UI layer, including when Room or Death has a later scene index.
    const unmount =
      sceneDomUi(this)?.mount(Number.MAX_SAFE_INTEGER, view.root) ?? (() => view.root.remove());
    this.events.once("shutdown", unmount);
    startWakeLock();
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
      if (this.state === "settings" || this.state === "achievements") {
        const card = this.nestedCard(this.state);
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

  // Capture the world once; the DOM layer dims touch controls as the card covers them.
  private context() {
    return menuContext(
      (key) => this.scene.isActive(key),
      (key) => this.scene.isPaused(key),
      this.pausableScene(),
    );
  }

  private entryAvailable(): boolean {
    const context = this.context();
    return (
      this.live &&
      this.state === "closed" &&
      this.view?.pauseButton.closest("[inert]") === null &&
      context !== undefined &&
      menuSourceReady(this.scene.get(context.scene)) &&
      (context.scene !== ZONE || !this.playCovered())
    );
  }

  private async open(global = false): Promise<void> {
    const context = this.context();
    if (this.state === "opening") {
      return;
    }
    if (
      context === undefined ||
      !this.entryAvailable() ||
      (!global && (this.state !== "closed" || this.pausableScene() === undefined)) ||
      (this.state === "open" && modalInput(this).accepts())
    ) {
      return;
    }
    if (this.state !== "closed") {
      this.frames.push({
        dimmed: this.dim !== undefined,
        held: this.heldScenes,
        homeShown: this.homeShown,
        mode: this.mode,
        nestedFocus: this.nestedFocus,
        over: this.overScene,
        returnEntryFocus: this.returnEntryFocus,
        state: this.state,
        waitFor: this.state === "open" ? context.scene : undefined,
      });
    }
    const generation = ++this.menuGeneration;
    // Disabling the entry during readiness can blur it before the modal captures its opener.
    this.returnEntryFocus = document.activeElement === this.view?.pauseButton;
    this.state = "opening";
    this.closeModal?.();
    this.closeModal = undefined;
    modalInput(this).close();
    this.overScene = context.scene;
    this.mode = context.mode;
    this.homeShown = context.homeShown;
    this.waitingFor = undefined;
    this.heldScenes = MENU_CONTENT_SCENES.filter((key) => this.scene.isActive(key));
    modalInput(this).open();
    this.releasePauseButton();
    this.heldScenes.forEach((key) => this.scene.pause(key));
    this.scene.bringToTop();
    stopWakeLock();
    this.showControls();
    if (this.dim === undefined) {
      await this.dimZone(BLOCKING_CARDS.includes(context.scene as (typeof BLOCKING_CARDS)[number]));
    }
    if (!this.live || generation !== this.menuGeneration || this.state !== "opening") {
      return;
    }
    this.state = "open";
    this.showCard(true);
  }

  private close(): void {
    if (this.state !== "open" || !modalInput(this).accepts()) {
      return;
    }
    const returnToEntry = this.returnEntryFocus;
    this.returnEntryFocus = false;
    this.state = "closed";
    modalInput(this).close();
    this.showCard(false);
    this.heldScenes.forEach((key) => this.scene.resume(key));
    const frame = this.frames.pop();
    if (frame !== undefined) {
      if (!frame.dimmed) {
        this.destroyDim();
      }
      this.state = frame.state;
      this.heldScenes = frame.held;
      this.overScene = frame.over;
      this.returnEntryFocus = frame.returnEntryFocus;
      this.mode = frame.mode;
      this.nestedFocus = frame.nestedFocus;
      this.homeShown = frame.homeShown;
      this.waitingFor = frame.waitFor;
      this.restoreEntryFocus(returnToEntry);
      return;
    }
    this.destroyDim();
    this.overScene = undefined;
    this.heldScenes = [];
    startWakeLock();
    this.restoreEntryFocus(returnToEntry);
  }

  private restoreEntryFocus(focused: boolean): void {
    this.showControls();
    const entry = this.view?.pauseButton;
    if (focused && entry?.isConnected && !entry.disabled && !entry.hidden) {
      focusTarget(entry);
    }
  }

  private syncMenuVisibility(): void {
    if (this.state !== "open" || this.view === undefined) {
      return;
    }
    if (this.waitingFor !== undefined) {
      if (this.scene.isActive(this.waitingFor) || this.scene.isPaused(this.waitingFor)) {
        return;
      }
      this.waitingFor = undefined;
      modalInput(this).open();
      this.showCard(true);
    }
  }

  // Ends content and shows the start screen, keeping the persistent pause overlay.
  // Cheats' Load stage: the menu closes and stage plays, entered as the map's stage picker enters
  // it, from whatever the menu covered.
  loadStage(stage: string): void {
    saveStand(stage);
    this.leaveMenu(ZONE, { node: stage } satisfies ZoneData);
  }

  // After Reset save: the menu closes on the start screen, as Back to title does.
  returnToStart(): void {
    this.returnHome();
  }

  private returnHome(): void {
    updateOffer.defer();
    this.leaveMenu(START);
  }

  // Closes the menu, stops every scene it covered and launches key with data.
  private leaveMenu(key: string, data?: object): void {
    this.frames = [];
    this.returnEntryFocus = false;
    this.waitingFor = undefined;
    this.state = "closed";
    this.overScene = undefined;
    this.heldScenes = [];
    modalInput(this).close();
    this.destroyDim();
    this.showCard(false);
    MENU_CONTENT_SCENES.filter(
      (key) => this.scene.isActive(key) || this.scene.isPaused(key),
    ).forEach((key) => this.scene.stop(key));
    if (data === undefined) {
      this.scene.launch(key);
    } else {
      this.scene.launch(key, data);
    }
    startWakeLock();
  }

  // Saves a touch setting and updates the DOM controls under the existing modal dim.
  setTouchSetting(setting: TouchSetting, shown: boolean): void {
    setTouchSettingShown(setting, shown);
    if (this.scene.isActive(ZONE) || this.scene.isPaused(ZONE)) {
      (this.scene.get(ZONE) as ZoneScene).showTouchControls(touchSettings());
    }
  }

  // Nested cards keep the held scenes and return focus to their originating action.
  private openNested(key: "achievements" | "settings", invoker: HTMLButtonElement): void {
    if (this.view === undefined) {
      return;
    }
    if (this.scene.isActive(key) || this.scene.isPaused(key)) {
      const update = this.overScene === "update";
      this.close();
      if (update) {
        updateOffer.defer();
      }
      return;
    }
    this.state = key;
    this.nestedFocus = invoker;
    this.scene.launch(key, { opener: this.scene.key } satisfies SettingsData);
  }

  // Closing either nested card returns to the same shared menu.
  settingsClosed(): void {
    this.nestedClosed("settings");
  }

  achievementsClosed(): void {
    this.nestedClosed("achievements");
  }

  private nestedClosed(key: "achievements" | "settings"): void {
    const view = this.view;
    if (!this.live || this.state !== key || view === undefined) {
      return;
    }
    this.state = "open";
    modalInput(this).open();
    this.showCard(true);
    focusTarget(this.nestedFocus ?? view.card.dialog);
    this.nestedFocus = undefined;
  }

  private nestedCard(key: "achievements" | "settings"): AchievementsScene | SettingsScene {
    return this.scene.get(key) as AchievementsScene | SettingsScene;
  }

  private enabledSkills(): readonly SkillId[] {
    const overrides = developmentSkillOverrides();
    const owned = savedSkills();
    return SKILL_IDS.filter((skill) => skillEnabled(overrides, owned, skill));
  }

  private openSkill(skill: SkillId): void {
    if (
      this.state !== "closed" ||
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
    this.destroyDim();
    this.showCard(false);
    // Details hold active play until their own close callback.
    if (this.scene.isActive(ZONE)) {
      this.scene.pause(ZONE);
    }
    stopWakeLock();
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
    if (!this.live || this.state !== "skill") {
      return;
    }
    this.state = "closed";
    modalInput(this).close();
    const zone = this.scene.get(ZONE) as ZoneScene;
    zone.resumeSkillPlay();
    if (!this.playCovered() && modalInput(this).accepts()) {
      this.scene.resume(ZONE);
      startWakeLock();
    }
    this.showControls();
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

  // Modal cover changes input and dimming, while the zone's presentation owns HUD visibility.
  private skillHudShown(): boolean {
    return (
      (this.scene.isActive(ZONE) || this.scene.isPaused(ZONE)) &&
      ((this.scene.get(ZONE) as ZoneScene).skillState()?.shown === true ||
        CONVERSATIONS.some((key) => this.scene.isActive(key) || this.scene.isPaused(key)))
    );
  }

  // Skill actions belong only to uncovered active play.
  private skillHudLive(): boolean {
    if (!modalInput(this).accepts() || this.playCovered()) {
      return false;
    }
    return (
      this.state === "closed" &&
      this.scene.isActive(ZONE) &&
      (this.scene.get(ZONE) as ZoneScene).skillState()?.shown === true
    );
  }

  // The pause button and the skill HUD as the state leaves them.
  private showControls(): void {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    const pauseShown = this.context() !== undefined;
    view.pauseButton.disabled = !this.entryAvailable();
    const mode = this.state === "closed" ? (this.context()?.mode ?? "menu") : this.mode;
    view.pauseButton.tabIndex =
      mode === "pause" || (this.state === "open" && modalInput(this).accepts()) ? -1 : 0;
    if (mode !== this.entryMode) {
      this.entryMode = mode;
      this.cancelPresses();
      this.releasePauseButton();
      showPauseDisc(this.colours, this.timeline.rest, view.pauseButton, mode);
    }
    view.pauseButton.setAttribute(
      "aria-label",
      mode === "pause" ? TEXT.pause.button : TEXT.menu.button,
    );
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
      view.skills[skill].button.disabled = !live;
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

  private destroyDim(): void {
    this.dim?.destroy();
    this.dim = undefined;
  }

  // Actual entry and exit own card visibility; nested modal cover keeps its parent painted.
  private showCard(open: boolean): void {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    this.dim?.setVisible(open);
    view.card.root.hidden = !open;
    if (open) {
      showPauseMenu(TEXT, this.mode, this.homeShown, view);
      this.closeModal ??= sceneDomUi(this)?.modals.open(
        { backdrop: view.card.backdrop, close: () => this.close(), isolation: "dialog" },
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

  private foregroundScene(): string | undefined {
    if (this.scene.isActive("boot")) {
      return undefined;
    }
    return (
      CONTENT_SCENES.find((key) => this.scene.isActive(key)) ??
      CONTENT_SCENES.find((key) => this.scene.isPaused(key))
    );
  }

  private pausableScene(): string | undefined {
    if (BLOCKING_CARDS.some((key) => this.scene.isActive(key))) {
      return undefined;
    }
    const key = this.foregroundScene();
    if (key === undefined || (key === ZONE && this.playCovered())) {
      return undefined;
    }
    const scene = this.scene.get(key);
    const pausable = scene as unknown as Partial<PausableConversation>;
    if (
      pausable.pausable?.() === false ||
      !modalInput(key === ZONE ? this : scene).accepts() ||
      !menuSourceReady(scene)
    ) {
      return undefined;
    }
    return key;
  }

  private blocked(): boolean {
    return (
      this.state === "closed" && (!this.entryAvailable() || this.pausableScene() === undefined)
    );
  }

  override update(): void {
    this.syncMenuVisibility();
    this.showControls();
  }

  // Capture the next rendered frame, with an opaque palette fallback when readback fails.
  modalBackdropShown(): boolean {
    return this.dim !== undefined && this.state !== "opening";
  }

  private async dimZone(alreadyDimmed = false): Promise<void> {
    const dim = showModalBackdrop(this, alreadyDimmed);
    this.dim = dim;
    await dim.ready;
    if (this.dim === dim) {
      dim.setVisible(false);
    }
  }

  private cardInput(): SceneInput {
    const content = this.state === "closed" ? this.pausableScene() : undefined;
    return modalInput(content === undefined || content === ZONE ? this : this.scene.get(content));
  }

  private releasePauseButton(): void {
    const stop = this.stopPausePress;
    this.stopPausePress = undefined;
    stop?.();
  }

  private cancelPresses(): void {
    this.actionBindings.forEach((binding) => binding.cancel());
    this.releasePauseButton();
  }

  private watchPresses(entryRoot: HTMLElement, view: PauseView): void {
    const document = view.root.ownerDocument;
    const input = modalInput(this);
    const entry = globalMenuInput(
      this,
      () => this.entryAvailable() && view.pauseButton.closest("[inert]") === null,
    );
    const gate = {
      accepts: () => !this.blocked() && modalInput(this).accepts(),
      capture: () => {
        const check = input.capture();
        return () => !this.blocked() && check();
      },
    };
    const controlAt = (event: PointerEvent): HTMLButtonElement | null => {
      const target =
        event.target instanceof Node && !event.target.isConnected
          ? document.elementFromPoint(event.clientX, event.clientY)
          : event.target;
      const control = target instanceof Element ? target.closest("button") : null;
      return control !== null &&
        !control.disabled &&
        control.closest("[inert]") === null &&
        (view.root.contains(control) || control === view.pauseButton)
        ? control
        : null;
    };
    this.actionBindings = [
      trackMenuActionBinding(
        this,
        bindSceneActions(
          { preventDefault: true, target: view.pauseButton, view: entryRoot },
          input,
          {
            activate: () => {
              void this.open(true);
            },
            controlAt: (event) => (controlAt(event) === view.pauseButton ? view.pauseButton : null),
            controls: [view.pauseButton],
            element: (button) => button,
            guard: { gate: entry },
            show: (button) => {
              this.releasePauseButton();
              if (button !== undefined) {
                this.stopPausePress = playPauseDiscPress(this.timeline, (pose) =>
                  showPauseDisc(this.colours, pose, view.pauseButton, this.entryMode),
                );
              }
            },
          },
        ),
      ),
      bindSceneButtons(
        input,
        { gate },
        [
          ...[...Object.values(view.card.buttons), view.card.close].map((button) => ({
            activate: () => this.activate(view, button),
            available: () => this.state === "open" && !button.hidden,
            element: button,
          })),
          {
            activate: () => this.close(),
            available: () => this.state === "open",
            element: view.card.backdrop,
          },
        ],
        view.card.root,
      ),
      bindSceneActions<SkillId>({ preventDefault: true, target: view.hud, view: view.hud }, input, {
        activate: (skill) => this.activate(view, view.skills[skill].button),
        available: (skill) =>
          this.sys.isActive() && this.skillHudLive() && !view.skills[skill].button.hidden,
        controlAt: (event) => {
          const skill = controlAt(event)?.dataset.skill as SkillId | undefined;
          return skill !== undefined && SKILL_IDS.includes(skill) ? skill : null;
        },
        controls: SKILL_IDS,
        element: (skill) => view.skills[skill].button,
        guard: { gate },
        hold: (skill) => this.openSkill(skill),
        rule: () => ({
          holdMs: SKILL_GESTURE.holdMilliseconds,
          slopPx: TOUCH.tapMaxDistance * readUnit(view.root),
        }),
      }),
    ];
    const keep = (event: Event) => event.preventDefault();
    for (const root of [view.root, view.pauseButton]) {
      root.addEventListener("pointerdown", keep, true);
      root.addEventListener("touchstart", keep, { capture: true, passive: false });
      root.addEventListener("touchend", keep, { capture: true, passive: false });
    }
    this.events.once("shutdown", () => {
      this.actionBindings.forEach((binding) => binding());
      this.actionBindings = [];
      for (const root of [view.root, view.pauseButton]) {
        root.removeEventListener("pointerdown", keep, true);
        root.removeEventListener("touchstart", keep, true);
        root.removeEventListener("touchend", keep, true);
      }
    });
  }

  // A control's action: the pause button opens the card, and the card's controls act while it is
  // open. During uncovered play a skill tap selects it, or turns it off when it is selected, and
  // its explicit hold opens details.
  private activate(view: PauseView, control: HTMLButtonElement): void {
    const { buttons, close } = view.card;
    const skill = control.dataset.skill as SkillId | undefined;
    if (control === view.pauseButton) {
      void this.open(true);
    } else if (control === close || control === buttons.resume) {
      this.close();
    } else if (control === buttons.settings && this.state === "open") {
      this.openNested("settings", control);
    } else if (control === buttons.achievements && this.state === "open") {
      this.openNested("achievements", control);
    } else if (control === buttons.home && this.state === "open") {
      this.returnHome();
    } else if (skill !== undefined && this.skillHudLive()) {
      selectActiveSkill(skill === activeSkill() ? null : skill);
    }
  }

  // Existing Pause shortcuts retain their content guards. Tab follows the card order;
  // Enter and Space on the card itself still take the primary action.
  private watchKeys(view: PauseView): void {
    const onPauseKey = (event: KeyboardEvent) => {
      const action = cardKeyAction(false, event.key, event.repeat);
      if (
        action === undefined ||
        this.state !== "closed" ||
        !this.entryAvailable() ||
        this.blocked() ||
        !this.cardInput().accepts(event)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.act(action);
    };
    // Capture before full-page story and room handlers can consume Escape or P.
    document.addEventListener("keydown", onPauseKey, true);
    this.input.keyboard?.on("keydown", onPauseKey);
    this.events.once("shutdown", () => {
      document.removeEventListener("keydown", onPauseKey, true);
      this.input.keyboard?.off("keydown", onPauseKey);
    });
    const onEntryKey = (event: KeyboardEvent) => {
      if (view.pauseButton.closest("[inert]") !== null) {
        return;
      }
      const context = this.context();
      if (
        this.state === "closed" &&
        context !== undefined &&
        context.scene !== ZONE &&
        !view.pauseButton.hidden &&
        !view.pauseButton.disabled
      ) {
        const root = view.root.ownerDocument.querySelector<HTMLElement>(
          `[data-menu-scene="${context.scene}"]`,
        );
        if (root !== null) {
          menuEntryFocus(view.root.ownerDocument, view.pauseButton, root, event);
        }
      }
      if (event.target === view.pauseButton && (event.key === "Enter" || event.key === " ")) {
        // Own entry activation before page controllers and native button defaults.
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) {
          view.pauseButton.click();
        }
      }
    };
    document.addEventListener("keydown", onEntryKey, true);
    this.events.once("shutdown", () => document.removeEventListener("keydown", onEntryKey, true));
    const { dialog } = view.card;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target === dialog && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat && this.state === "open" && modalInput(this).accepts(event)) {
          this.close();
        }
        return;
      }
      const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
      if (event.target === dialog && (action === "next" || action === "previous")) {
        event.preventDefault();
        event.stopPropagation();
        (action === "next" ? view.card.buttons.achievements : view.card.close).focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    this.events.once("shutdown", () => dialog.removeEventListener("keydown", onKeyDown));
  }
}
