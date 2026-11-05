import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { type Cameras, Core, type GameObjects, type Input, Scale, Scene, Scenes } from "phaser";

import { EDGE } from "../core";
import { SKILL_GESTURE } from "../data/skills";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { Rect, SkillId } from "../data/types";
import { developmentSkillOverrides } from "../dev/mode";
import { isSkillId, SKILL_IDS, skillEnabled } from "../progress";
import { coverZone, PHONE_EVENTS, startWakeLock, stopWakeLock, zoneShown } from "../pwa";
import {
  type CardAction,
  cardBackAction,
  cardKeyAction,
  cardTurnAction,
  coarsePointer,
  focusKeyAction,
  type Palette,
  PAUSE_BUTTON,
  pauseCard,
  type PressArea,
  pressedArea,
  setTouchSettingShown,
  shifted,
  SKILL_BUTTON,
  skillHud,
  stepFocus,
  topShift,
  type TouchSetting,
  touchSettings,
} from "../ui";
import { FRAME_TURN } from "../ui/input/frameTurn";
import {
  addCardHeading,
  addCardText,
  addSlice,
  addTextButton,
  captureTab,
  cardFonts,
  palette,
  paletteColour,
  pressTextButton,
  PRIMARY_BUTTON,
  ringFocus,
  type TextButton,
} from "./cardParts";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput, onScenePointer } from "./modalInput";
import { catchModalTaps } from "./modalTaps";
import { createPauseChrome, PAUSE_CHROME_KEY } from "./pauseChrome";
import { fitCanvasCamera, fitPlayCamera, playPoint } from "./playCamera";
import { activeSkill, savedSkills, selectActiveSkill } from "./save";
import type { SettingsData, SettingsOpener, SettingsScene } from "./SettingsScene";
import { drawSkillButton } from "./skillButton";
import type { SkillDetailData } from "./SkillDetailScene";
import type { ZoneScene } from "./ZoneScene";

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

type Control = "close" | "home" | "pauseButton" | "resume" | "settings" | SkillId;
type CardControl = Exclude<Control, "pauseButton">;

// The card's controls, in the order the keyboard's focus moves through them.

// The card's buttons, top to bottom.
type CardButton = "home" | "resume" | "settings";
const BUTTONS: readonly CardButton[] = ["resume", "settings", "home"];

// The pause card over the dimmed zone, and the pause button that opens it, which shows on a
// touch screen while a zone plays, never on the map. It runs beside the zone from the start.
// Opening the card pauses the zone and lets the screen sleep; Resume (the primary button, at the
// top), the close X, back, Escape, P and a tap outside the card (closeOnOutsideTap) close it.
// Settings opens SettingsScene's card over the same dim in the pause card's place, and passes it
// the keys and back until it closes; Back to title ends the zone for the start screen.
export class PauseScene extends Scene implements SettingsOpener {
  private skillVisit = 0;
  private hud = new Map<SkillId, ReturnType<typeof drawSkillButton>>();
  private layout!: ReturnType<typeof pauseCard>;
  private card!: GameObjects.Container;
  // The control the keyboard's focus is on, and art's ring round it.
  private focus: CardControl | undefined;
  private focusRing: GameObjects.NineSlice | undefined;
  private closeX!: GameObjects.Sprite;
  private dims = new Map<string, ReturnType<typeof showModalBackdrop>>();
  private pauseButton!: GameObjects.Sprite;
  // The control a press landed on, which acts if the press lifts on it too.
  private cardCamera!: Cameras.Scene2D.Camera;
  private pressed: Control | undefined;
  private pressStart:
    | {
        readonly control: Control;
        readonly id: number;
        readonly startedAt: number;
        readonly x: number;
        readonly y: number;
        cancelled: boolean;
      }
    | undefined;
  private buttons!: Readonly<Record<CardButton, TextButton>>;
  private state: "closed" | "open" | "opening" | "settings" | "skill" = "closed";

  constructor() {
    super("pause");
  }

  create(): void {
    // The main camera covers the whole canvas, for the pause button at the view's top-left corner
    // and the dim over all of it; the card camera shows the cards in the game's view. Everything
    // added after the pause button and the dim belongs to the cards.
    const canvasCamera = this.cameras.main;
    fitCanvasCamera(this, canvasCamera);
    this.cardCamera = this.cameras.add();
    fitPlayCamera(this, this.cardCamera);
    this.pauseButton = createPauseChrome(this);
    this.placePauseButton();
    this.scale.on(Scale.Events.RESIZE, this.placePauseButton, this);
    this.events.once("shutdown", () =>
      this.scale.off(Scale.Events.RESIZE, this.placePauseButton, this),
    );
    this.dims = new Map();
    this.cardCamera.ignore(this.pauseButton);
    this.hud = new Map(
      SKILL_IDS.map((skill) => {
        const icon = drawSkillButton(this, { x: 0, y: 0 }, skill);
        icon.visible(false);
        this.cardCamera.ignore(icon.objects);
        return [skill, icon];
      }),
    );
    const toCards = (object: GameObjects.GameObject) => canvasCamera.ignore(object);
    this.events.on(Scenes.Events.ADDED_TO_SCENE, toCards);
    this.events.once("shutdown", () => this.events.off(Scenes.Events.ADDED_TO_SCENE, toCards));
    this.layout = pauseCard(cardFonts(this), TEXT.pause);
    this.card = this.drawCard();
    this.showCard(false);
    this.watchPresses();
    modalInput(this).subscribe(() => {
      this.pressStart = undefined;
      this.setPressed(undefined);
    });
    catchModalTaps(this, this.cardCamera, {
      close: () => this.close(),
      covered: () => this.coveredCard(),
    });
    this.watchKeys();
    const onBack = (event: Event) => {
      if (this.playCovered()) {
        return;
      }
      if (this.state === "settings") {
        const card = this.settings();
        if (modalInput(card).accepts(event)) {
          card.back();
        }
      } else if (modalInput(this).accepts(event)) {
        this.act(cardBackAction(this.state === "open"));
      }
    };
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    // The page frame turning mid-play pauses it, as P does; open only while the zone plays.
    const stopTurns = FRAME_TURN.onChange(() => this.act(cardTurnAction(this.state !== "closed")));
    this.events.once("shutdown", () => {
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack);
      stopTurns();
    });
    this.events.once("shutdown", () => {
      this.pressStart = undefined;
      if (this.state === "skill") {
        this.state = "closed";
        this.scene.stop("skillDetail");
        coverZone("pauseCard", false);
      }
    });
    startWakeLock();
    // The zone's first frame: the game page is now the home screen.
    this.game.events.once(Core.Events.POST_RENDER, () => zoneShown());
  }

  private act(action: CardAction | undefined): void {
    if (this.playCovered() || !modalInput(this).accepts()) {
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
    if (this.state !== "closed" || !this.scene.isActive(ZONE) || this.playCovered()) {
      return;
    }
    this.card.destroy(true);
    this.layout = pauseCard(cardFonts(this), TEXT.pause);
    this.card = this.drawCard();
    this.state = "opening";
    this.hud.forEach((icon) => icon.visible(false));
    modalInput(this).open();
    this.setPressed(undefined);
    this.scene.pause(ZONE);
    stopWakeLock();
    coverZone("pauseCard", true);

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
    this.showCard(true);
    captureTab(this, true);
    this.state = "open";
  }

  private close(): void {
    if (this.state !== "open") {
      return;
    }
    this.state = "closed";
    modalInput(this).close();
    this.dims.forEach((dim) => dim.destroy());
    this.dims.clear();
    this.showCard(false);
    captureTab(this, false);
    this.scene.resume(ZONE);
    startWakeLock();
    coverZone("pauseCard", false);
  }

  // Ends the zone and shows the start screen, this scene staying beside it for the next zone.
  private returnHome(): void {
    this.state = "closed";
    modalInput(this).close();
    this.dims.forEach((dim) => dim.destroy());
    this.dims.clear();
    this.showCard(false);
    captureTab(this, false);
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
    this.state = "settings";
    this.card.setVisible(false);
    this.focusRing = ringFocus(this, this.focusRing, undefined);
    this.scene.launch(SETTINGS, { opener: this.scene.key } satisfies SettingsData);
  }

  private coveredCard(): readonly Rect[] | undefined {
    return this.state === "open"
      ? [
          this.layout.card,
          this.layout.close.hit,
          ...BUTTONS.map((name) => this.layout[name].hit),
          ...this.hudAreas().map(({ hit }) => hit),
        ]
      : undefined;
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
    this.dims.forEach((dim) => dim.destroy());
    this.dims.clear();
    this.showCard(false);
    this.hud.forEach((icon) => icon.visible(false));
    captureTab(this, false);
    this.scene.pause(ZONE);
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

  private skillHudVisible(): boolean {
    if (!modalInput(this).accepts() || this.playCovered()) {
      return false;
    }
    return this.state === "open"
      ? this.scene.isPaused(ZONE)
      : this.state === "closed" &&
          this.scene.isActive(ZONE) &&
          (this.scene.get(ZONE) as ZoneScene).skillState()?.shown === true;
  }

  private hudAreas(): { readonly art: Rect; readonly hit: Rect; readonly key: SkillId }[] {
    return [...skillHud(this.enabledSkills())].map(([skill, at]) => ({
      art: { ...at, height: SKILL_BUTTON.target, width: SKILL_BUTTON.target },
      hit: { ...at, height: SKILL_BUTTON.target, width: SKILL_BUTTON.target },
      key: skill,
    }));
  }

  private showSkillHud(): void {
    const row = skillHud(this.enabledSkills());
    const selected = activeSkill();
    this.hud.forEach((icon, skill) => {
      const at = row.get(skill);
      if (at) {
        icon.place(shifted(topShift(this.scale.gameSize), at));
      }
      icon.visible(this.skillHudVisible() && at !== undefined);
      icon.ready(skill === selected && this.skillReady(skill));
      icon.selected(skill === selected);
    });
  }

  private updateSkillHold(): void {
    const press = this.pressStart;
    if (
      !this.sys.isActive() ||
      !press ||
      press.cancelled ||
      !isSkillId(press.control) ||
      this.state !== "closed" ||
      !this.skillHudVisible() ||
      this.time.now - press.startedAt < SKILL_GESTURE.holdMilliseconds
    ) {
      return;
    }
    this.pressStart = undefined;
    this.setPressed(undefined);
    this.openSkill(press.control);
  }

  // The settings card has closed: the pause card shows again.
  settingsClosed(): void {
    if (this.state === "settings") {
      this.state = "open";
      this.card.setVisible(true);
      this.drawFocus();
    }
  }

  private settings(): SettingsScene {
    return this.scene.get(SETTINGS) as SettingsScene;
  }

  // The dim behind the cards, with the touch buttons as the setting shows them.
  private renderDim(): void {
    const key = dimTexture(touchSettings());
    this.dims.forEach((dim, name) => dim.setVisible(name === key));
  }

  private showCard(open: boolean): void {
    this.card.setVisible(open);
    this.dims.forEach((dim, name) => dim.setVisible(open && name === dimTexture(touchSettings())));
    this.focus = undefined;
    this.drawFocus();
    this.showPauseButton();
  }

  private drawFocus(): void {
    const rect = this.focus === undefined ? undefined : this.focusedRect(this.focus);
    this.focusRing = ringFocus(this, this.focusRing, rect);
  }

  // What the focus ring surrounds: a button, the close X itself, or a shown skill's target.
  private focusedRect(control: CardControl): Rect | undefined {
    if (control === "close") {
      const { at } = this.layout.close;
      return { height: this.closeX.height, width: this.closeX.width, ...at };
    }
    if (isSkillId(control)) {
      const at = skillHud(this.enabledSkills()).get(control);
      return at && { ...at, height: SKILL_BUTTON.target, width: SKILL_BUTTON.target };
    }
    return this.layout[control].button;
  }

  // The pause button shows on a touch screen while a zone plays and the card is closed. The map
  // between zones has nothing to pause, so it shows none.
  private showPauseButton(): void {
    this.pauseButton.setVisible(
      this.state === "closed" &&
        !this.playCovered() &&
        this.scene.isActive(ZONE) &&
        coarsePointer(window),
    );
  }

  private playCovered(): boolean {
    return (this.scene.get(ZONE) as ZoneScene).playCovered();
  }

  override update(): void {
    this.updateSkillHold();
    this.showPauseButton();
    this.showSkillHud();
  }

  // Capture the next rendered frame, with an opaque palette fallback when readback fails.
  private async dimZone(key: string): Promise<void> {
    this.dims.forEach((dim) => dim.setVisible(false));
    const dim = showModalBackdrop(this);
    this.dims.set(key, dim);
    await dim.ready;
    dim.setVisible(false);
  }

  private drawCard(): GameObjects.Container {
    const { card, close } = this.layout;
    const words = TEXT.pause;
    const objects: GameObjects.GameObject[] = [
      this.slice("ui-settings-card", card),
      addCardHeading(this, this.layout.title),
    ];
    this.closeX = this.add.sprite(close.at.x, close.at.y, "ui-close").setOrigin(0);
    this.buttons = {
      home: addTextButton(this, this.layout.home, words.home),
      resume: addTextButton(this, this.layout.resume, words.resume, { style: PRIMARY_BUTTON }),
      settings: addTextButton(this, this.layout.settings, words.settings),
    };
    this.setPressed(undefined);
    return this.add.container(0, 0, [
      ...objects,
      this.closeX,
      ...BUTTONS.flatMap((name) => {
        const { faces, label } = this.buttons[name];
        return [faces.normal, faces.pressed, label.label, ...(label.mark ? [label.mark] : [])];
      }),
    ]);
  }

  // A pressed control shows its pressed look until the press lifts: the pause button plays its
  // press tag, then holds, as the touch buttons do; a card button's face and label sink.
  private setPressed(control: Control | undefined): void {
    this.pressed = control;
    this.closeX.play(animationKey("ui-close", control === "close" ? "pressed" : "normal"));
    for (const name of BUTTONS) {
      pressTextButton(this.buttons[name], control === name);
    }
    this.pauseButton.chain();
    if (control === "pauseButton") {
      this.pauseButton
        .play(animationKey(PAUSE_CHROME_KEY, "press"))
        .chain(animationKey(PAUSE_CHROME_KEY, "held"));
    } else {
      this.pauseButton.play(animationKey(PAUSE_CHROME_KEY, "rest"));
    }
  }

  // Puts the pause button at its place shifted across with the view, so it stays inside it.
  private placePauseButton(): void {
    const at = shifted(topShift(this.scale.gameSize), PAUSE_BUTTON.at);
    this.pauseButton.setPosition(at.x, at.y);
  }

  private controlAt(pointer: Input.Pointer): Control | undefined {
    if (this.playCovered()) {
      return undefined;
    }
    const { close } = this.layout;
    const areas: PressArea<Control>[] =
      this.state === "open"
        ? [
            { art: close.art, hit: close.hit, key: "close" },

            ...BUTTONS.map((key) => ({
              art: this.layout[key].button,
              hit: this.layout[key].hit,
              key,
            })),
          ]
        : this.pauseButton.visible
          ? [{ art: PAUSE_BUTTON.art, hit: PAUSE_BUTTON.hit, key: "pauseButton" }]
          : [];
    if (this.skillHudVisible()) {
      areas.push(...this.hudAreas());
    }
    const point =
      this.state === "open"
        ? playPoint(this, pointer, this.cardCamera)
        : shifted(topShift(this.scale.gameSize), { x: pointer.x, y: pointer.y }, -1);
    return pressedArea(areas, point);
  }

  // A control acts when a press lands on it and lifts on it.
  private watchPresses(): void {
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      if (this.pressStart) {
        return;
      }
      const control = this.controlAt(pointer);
      if (control === undefined) {
        return;
      }
      this.input.stopPropagation();
      this.pressStart = {
        cancelled: false,
        control,
        id: pointer.id,
        startedAt: this.time.now,
        x: pointer.x,
        y: pointer.y,
      };
      this.setPressed(control);
    });
    onScenePointer(this, "pointermove", (pointer: Input.Pointer) => {
      if (this.pressStart?.id === pointer.id) {
        this.input.stopPropagation();
        this.pressStart.cancelled ||=
          this.controlAt(pointer) !== this.pressStart.control ||
          Math.hypot(pointer.x - this.pressStart.x, pointer.y - this.pressStart.y) >
            TOUCH.tapMaxDistance;
        if (this.pressStart.cancelled) {
          this.setPressed(undefined);
        }
      }
    });
    const up = (pointer: Input.Pointer, outside: boolean) => {
      if (this.pressStart?.id !== pointer.id) {
        return;
      }
      this.input.stopPropagation();
      const start = this.pressStart;
      const control = this.pressed;
      this.pressStart = undefined;
      this.setPressed(undefined);
      if (
        !outside &&
        !pointer.wasCanceled &&
        !start.cancelled &&
        Math.hypot(pointer.x - start.x, pointer.y - start.y) <= TOUCH.tapMaxDistance &&
        control !== undefined &&
        control === this.controlAt(pointer)
      ) {
        if (
          this.state === "closed" &&
          isSkillId(control) &&
          this.time.now - start.startedAt >= SKILL_GESTURE.holdMilliseconds
        ) {
          this.openSkill(control);
        } else {
          this.press(control);
        }
      }
    };
    onScenePointer(this, "pointerup", (pointer) => up(pointer, false));
    onScenePointer(this, "pointerupoutside", (pointer) => up(pointer, true));
  }

  private press(control: Control): void {
    if (control === "dash" || control === "doubleJump" || control === "speedy") {
      if (this.state === "open") {
        this.openSkill(control);
      } else {
        selectActiveSkill(control);
      }
      return;
    }
    const actions: Record<Exclude<Control, SkillId>, () => void> = {
      close: () => this.close(),
      home: () => this.returnHome(),
      pauseButton: () => void this.open(),
      resume: () => this.close(),
      settings: () => this.openSettings(),
    };
    actions[control]();
  }

  private watchKeys(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (this.state === "opening" || this.state === "skill" || this.playCovered()) {
        return;
      }
      if (this.state === "settings") {
        this.settings().key(event);
        return;
      }
      if (!modalInput(this).accepts(event)) {
        return;
      }
      const action =
        this.state === "open" ? focusKeyAction(event.key, event.shiftKey, event.repeat) : undefined;
      if (action === "next" || action === "previous") {
        this.focus = stepFocus<CardControl>(
          [...BUTTONS, ...this.enabledSkills(), "close"],
          this.focus,
          action,
        );
        this.drawFocus();
      } else if (action === "press") {
        if (this.focus !== undefined) {
          this.press(this.focus);
        }
      } else {
        this.act(cardKeyAction(this.state === "open", event.key, event.repeat));
      }
    });
  }

  private slice(key: string, rect: Rect): GameObjects.NineSlice {
    return addSlice(this, key, rect);
  }

  private text(
    font: string,
    x: number,
    y: number,
    text: string,
    colour: number,
  ): GameObjects.BitmapText {
    return addCardText(this, font, { x, y }, text, colour);
  }

  private palette(): Palette {
    return palette(this);
  }

  private colour(name: string): number {
    return paletteColour(this, name);
  }
}
