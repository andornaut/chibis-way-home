import { animationKey, type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { frameSteps, startStepClock, type StepClock } from "@andornaut/game-kit/clock/fixedStep";
import { fillNames } from "@andornaut/game-kit/lines";
import {
  phaserBitmapFont,
  type PhaserFontData,
} from "@andornaut/game-kit/text/phaser/phaserBitmapFont";
import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import { type Cameras, type GameObjects, type Input, Scene, Scenes } from "phaser";

import { PLAY_STEP_LIMITS, STEP_SECONDS } from "../core/index.ts";
import { CHARACTERS } from "../data/characters.ts";
import { DIALOGUES, SPEAKERS } from "../data/dialogues.ts";
import { ROOM_LAYOUT } from "../data/layout.ts";
import { ROOMS } from "../data/rooms.ts";
import { TEXT } from "../data/text.ts";
import type { RoomPlan } from "../data/types/index.ts";
import { coverZone, PHONE_EVENTS } from "../pwa/index.ts";
import {
  CARD_TEXT_SCALE,
  createRoomView,
  DIALOGUE_PORTRAIT_SIZE,
  dialogueParagraphs,
  dialogueSpeakerLayout,
  focusKeyAction,
  pressedArea,
  ROOM_SCREEN,
  type RoomEvent,
  roomEvent,
  roomPortraitProperties,
  type RoomView,
  SKILL_ART,
  SKILL_ROOM,
  skillDetails,
  skillRoomContinue,
  textInkBounds,
} from "../ui/index.ts";
import { drawActionHelp } from "./actionHelp.ts";
import {
  addButtonLabel,
  addCardHeading,
  addCardText,
  addSlice,
  BUTTON,
  type ButtonLabel,
  captureTab,
  cardFonts,
  paletteColour,
  placeButtonLabel,
  PRIMARY_BUTTON,
  ringFocus,
  TITLE_FONT,
} from "./cardParts.ts";
import { drawDialoguePanel } from "./dialoguePanel.ts";
import { drawDialogueParagraph } from "./dialogueParagraph.ts";
import { followTaps } from "./domTaps.ts";
import { artFrameUrl, mountSceneView, revealSceneView, sceneDomUi } from "./domUi.ts";
import { modalInput, onScenePointer } from "./modalInput.ts";
import { fitCanvasCamera, fitPlayCamera, playPoint } from "./playCamera.ts";
import { grantSkill, recordRoomTime } from "./save.ts";
import { drawSkillButton } from "./skillButton.ts";
import { uiObject } from "./uiRoots.ts";

const ZONE = "zone";

// What a room opens with: its key in ROOMS, and the stage whose door leads to it.
export interface RoomData {
  readonly room: string;
  readonly stage: string;
}

// The room behind a door, over the whole canvas in place of the zone, which ZoneScene pauses
// while it shows: the room's backdrop (or a placeholder ink fill with a frame), its animations
// and cast, its name, and Leave at the top right. Leave, back and Escape each close it and resume
// the zone, which returns him to the door (ZoneScene). Tab and the arrows focus Leave, and Enter
// and Space press it once focused. Time in the room is active play: it counts toward the stage's
// attempt and totals on the zone's step clock, and time while the room is paused does not.
export class RoomScene extends Scene {
  private contentCamera!: Cameras.Scene2D.Camera;
  private focused = false;
  private focusRing: GameObjects.NineSlice | undefined;
  private leaveFaces!: { normal: GameObjects.NineSlice; pressed: GameObjects.NineSlice };
  private leaveLabel!: ButtonLabel;
  private leaving = false;
  private pressed: "leave" | undefined;
  private room!: RoomPlan;
  private roomKey = "";
  private stage = "";
  private clock: StepClock = startStepClock;
  private canvasUi: { setVisible(visible: boolean): unknown }[] = [];
  private domReady = false;
  private portrait: GameObjects.Sprite | undefined;
  private portraitFrames = new Map<string, string>();
  private portraitFrame: string | undefined;
  private view: RoomView | undefined;
  private visit = 0;

  constructor() {
    super("room");
  }

  init(data: RoomData): void {
    const room = ROOMS[data.room];
    if (!room) {
      throw new Error(`No room ${data.room}`);
    }
    this.room = room;
    this.roomKey = data.room;
    this.stage = data.stage;
    this.clock = startStepClock;
    this.focused = false;
    this.focusRing = undefined;
    this.leaving = false;
    this.pressed = undefined;
    this.canvasUi = [];
    this.domReady = false;
    this.portrait = undefined;
    this.portraitFrames = new Map();
    this.portraitFrame = undefined;
    this.view = undefined;
    this.visit++;
    if (room.grant !== undefined) {
      grantSkill(room.grant);
    }
  }

  create(): void {
    // The main camera fills the whole canvas with ink; the content camera shows the room in the
    // game's view, and everything is added to it alone.
    const canvasCamera = this.cameras.main;
    fitCanvasCamera(this, canvasCamera);
    canvasCamera.setBackgroundColor(this.colour("ink"));
    this.contentCamera = this.cameras.add();
    fitPlayCamera(this, this.contentCamera);
    const toContent = (object: GameObjects.GameObject) => canvasCamera.ignore(object);
    this.events.on(Scenes.Events.ADDED_TO_SCENE, toContent);
    this.events.once("shutdown", () => this.events.off(Scenes.Events.ADDED_TO_SCENE, toContent));
    this.scene.setVisible(false, ZONE);
    const restartClock = () => {
      this.clock = startStepClock;
    };
    this.events.on("resume", restartClock);
    this.events.once("shutdown", () => this.events.off("resume", restartClock));
    coverZone("room", true);
    captureTab(this, true);

    if (this.room.grant === undefined) {
      this.drawRoom();
    } else {
      this.rememberUi(() => this.drawRoom());
    }
    this.rememberUi(() => this.drawLeave());
    this.render();
    this.watchInput();
    modalInput(this).subscribe(() => {
      this.pressed = undefined;
      this.render();
    });
    this.createDomView();
  }

  private rememberUi(draw: () => void): void {
    const before = new Set(this.children.list);
    draw();
    for (const child of this.children.list) {
      if (!before.has(child) && "setVisible" in child && typeof child.setVisible === "function") {
        this.canvasUi.push(
          uiObject(this, child as GameObjects.GameObject & GameObjects.Components.Visible),
        );
      }
    }
  }

  private drawRoom(): void {
    if (this.room.grant !== undefined) {
      const words = TEXT.skills[this.room.grant];
      const layout = skillDetails(cardFonts(this), SKILL_ROOM.bounds, TEXT.buttons, words);
      addSlice(this, "ui-settings-card", layout.card);
      addCardHeading(this, layout.title!);
      drawActionHelp(this, this.colour("ink"), layout.groups.description!, layout.description);
      const icon = drawSkillButton(this, layout.groups.icon!, this.room.grant);
      icon.ready(true);
      const dialogue = this.room.enter === undefined ? undefined : DIALOGUES[this.room.enter];
      if (dialogue === undefined) {
        throw new Error("A skill room needs an entry dialogue");
      }
      {
        const paragraph = dialogueParagraphs(SPEAKERS, TEXT, dialogue)[0]!;
        drawDialoguePanel(this);
        drawDialogueParagraph(this, { ...paragraph, portrait: null });
        if (paragraph.portrait !== null) {
          const at = dialogueSpeakerLayout(paragraph.side).portrait;
          this.portrait = this.add
            .sprite(
              at.x + DIALOGUE_PORTRAIT_SIZE / 2,
              at.y + DIALOGUE_PORTRAIT_SIZE / 2,
              paragraph.portrait,
            )
            .play(animationKey(paragraph.portrait, "idle"));
        }
      }
      return;
    }
    const { animations = [], art, cast = [] } = this.room;
    if (art === undefined) {
      // PLACEHOLDER: a plain frame on the ink until the room has art.
      const { frame } = ROOM_SCREEN;
      this.add
        .graphics()
        .lineStyle(ROOM_LAYOUT.frameLine, this.colour("slate"))
        .strokeRect(frame.x, frame.y, frame.width, frame.height);
    } else {
      this.add.image(0, 0, art).setOrigin(0);
    }
    for (const { art: key, at, tag } of animations) {
      this.add.sprite(at.x, at.y, key).setOrigin(0).play(animationKey(key, tag));
    }
    for (const { at, character } of cast) {
      const who = CHARACTERS[character];
      if (!who) {
        throw new Error(`No character ${character} in room ${this.roomKey}`);
      }
      const sprite = this.add.sprite(at.x, at.y, who.art).setOrigin(0);
      const tag =
        who.animations?.idle ??
        [...sheetTags(this.cache.json.get(who.art) as AsepriteSheet).keys()][0];
      if (tag !== undefined) {
        sprite.play(animationKey(who.art, tag));
      }
    }
    const name = TEXT.rooms[this.roomKey]?.name ?? "";
    const font = phaserBitmapFont(this.cache.bitmapFont.get(TITLE_FONT).data as PhaserFontData);
    const { nameCentre } = ROOM_SCREEN;
    const ink = textInkBounds(font, CARD_TEXT_SCALE, font.lineHeight * CARD_TEXT_SCALE, name);
    this.rememberUi(() =>
      addCardText(
        this,
        TITLE_FONT,
        {
          x: nameCentre.x - ink.width / 2 - ink.x,
          y: nameCentre.y - ink.height / 2 - ink.y,
        },
        name,
        this.colour("cream"),
      ),
    );
  }

  private createDomView(): void {
    const layer = sceneDomUi(this);
    if (layer === undefined) {
      return;
    }
    const visit = this.visit;
    const skill = this.room.grant;
    const words = skill === undefined ? undefined : TEXT.skills[skill];
    const dialogue = this.room.enter === undefined ? undefined : DIALOGUES[this.room.enter];
    const paragraph =
      dialogue === undefined ? undefined : dialogueParagraphs(SPEAKERS, TEXT, dialogue)[0];
    if (words !== undefined && paragraph === undefined) {
      throw new Error("A skill room needs an entry dialogue");
    }
    const view = createRoomView(
      layer.element.ownerDocument,
      {
        cream: this.colour("cream"),
        ink: this.colour("ink"),
        navy: this.colour("navy"),
        white: this.colour("white"),
        yellow: this.colour("yellow"),
      },
      this.leaveLayout(),
      {
        action: words === undefined ? TEXT.room.leave : TEXT.dialogue.continue,
        actions: TEXT.buttons,
        icons: TEXT.actionIcons,
        name: TEXT.rooms[this.roomKey]?.name ?? "",
        ...(words === undefined || paragraph === undefined
          ? {}
          : {
              gift: {
                description: words.description,
                disc: fillNames(TEXT.skillDetails.disc, { skill: words.title }),
                paragraph,
                title: words.title,
              },
            }),
      },
    );
    this.view = view;
    if (view.panel !== undefined && this.portrait !== undefined) {
      writeLayoutProperties(roomPortraitProperties(this.portrait), view.panel.portrait);
    }
    const urls: Promise<string>[] = [];
    if (skill !== undefined && view.glyph !== undefined) {
      const glyph = view.glyph;
      const art = SKILL_ART[skill];
      const frame = sheetTags(this.cache.json.get(art) as AsepriteSheet).get("ready")?.[0]?.frame;
      urls.push(
        artFrameUrl(this, art, frame, "ink").then((url) => {
          if (this.visit === visit) {
            glyph.src = url;
          }
          return url;
        }),
      );
    }
    if (paragraph?.portrait !== undefined && paragraph.portrait !== null) {
      const art = paragraph.portrait;
      const frames = sheetTags(this.cache.json.get(art) as AsepriteSheet).get("idle");
      if (frames === undefined) {
        throw new Error(`No idle portrait animation for ${art}`);
      }
      for (const { frame } of frames) {
        urls.push(
          artFrameUrl(this, art, frame).then((url) => {
            if (this.visit === visit) {
              this.portraitFrames.set(String(frame), url);
            }
            return url;
          }),
        );
      }
    }
    const reveal = revealSceneView(this, view.root, Promise.all(urls));
    const stopInput = this.watchDomInput(view);
    const portrait = () => this.renderDomPortrait();
    this.events.on(Scenes.Events.PRE_RENDER, portrait);
    this.events.once("shutdown", () => {
      this.visit++;
      this.domReady = false;
      this.view = undefined;
      reveal.cancel();
      stopInput();
      this.events.off(Scenes.Events.PRE_RENDER, portrait);
    });
    mountSceneView(this, view.root);
    void reveal.revealed.then(
      (shown) => {
        if (!shown || this.visit !== visit || this.leaving) {
          return;
        }
        this.domReady = true;
        this.canvasUi.forEach((part) => part.setVisible(false));
        this.focusRing?.setVisible(false);
        this.renderDomPortrait();
        if (this.focused) {
          focusTarget(view.leave);
        }
      },
      (error: unknown) => console.warn("The room UI failed to load", error),
    );
  }

  // Phaser advances the hidden UI portrait on its scene clock, including pauses and resumes.
  private renderDomPortrait(): void {
    const image = this.view?.panel?.portrait;
    if (!this.domReady || image === undefined || this.portrait === undefined) {
      return;
    }
    const frame = String(this.portrait.frame.name);
    const url = this.portraitFrames.get(frame);
    if (url !== undefined && frame !== this.portraitFrame) {
      this.portraitFrame = frame;
      image.src = url;
    }
  }

  private watchDomInput(view: RoomView): () => void {
    const input = modalInput(this);
    const onClick = (event: MouseEvent) => {
      if (event.detail === 0 && this.domReady && input.accepts(event)) {
        this.act({ down: "leave", kind: "press", up: "leave" });
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (!this.domReady || !input.accepts(event)) {
        return;
      }
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (focusKeyAction(event.key, event.shiftKey, event.repeat) === undefined &&
          ![" ", "Enter", "Escape", "p", "P"].includes(event.key))
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.act({ key: event.key, kind: "key", repeat: event.repeat, shift: event.shiftKey });
    };
    view.leave.addEventListener("click", onClick);
    view.root.addEventListener("keydown", onKey);
    const stopTaps = followTaps(
      { preventDefault: true, target: view.root, view: view.root },
      input,
      {
        accepts: () => this.domReady && !this.leaving,
        controlAt: (event) => (event.composedPath().includes(view.leave) ? "leave" : null),
        show: (pressed) => {
          this.pressed = pressed;
          this.render();
        },
        tap: () => this.act({ down: "leave", kind: "press", up: "leave" }),
      },
    );
    return () => {
      stopTaps();
      view.leave.removeEventListener("click", onClick);
      view.root.removeEventListener("keydown", onKey);
    };
  }

  private leaveLayout() {
    return this.room.grant === undefined
      ? ROOM_SCREEN.leave
      : skillRoomContinue(cardFonts(this), TEXT.dialogue.continue);
  }

  private drawLeave(): void {
    const leave = this.leaveLayout();
    const gift = this.room.grant !== undefined;
    const style = gift ? PRIMARY_BUTTON : BUTTON;
    const frames = sheetTags(this.cache.json.get(style.art) as AsepriteSheet);
    const face = (tag: "normal" | "pressed") =>
      addSlice(this, style.art, leave.art, frames.get(tag)?.[0]?.frame);
    this.leaveFaces = { normal: face("normal"), pressed: face("pressed") };
    this.leaveLabel = addButtonLabel(
      this,
      {
        colour: this.colour(style.label),
        marked: false,
      },
      leave.art,
      gift ? TEXT.dialogue.continue : TEXT.room.leave,
    );
  }

  // Leave as the press and the focus leave it.
  private render(): void {
    const leave = this.leaveLayout();
    const pressed = this.pressed === "leave";
    if (this.domReady && this.view !== undefined) {
      this.view.leave.toggleAttribute("data-pressed", pressed);
      return;
    }
    this.leaveFaces.normal.setVisible(!pressed);
    this.leaveFaces.pressed.setVisible(pressed);
    placeButtonLabel(pressed, false, this.leaveLabel);
    this.focusRing = ringFocus(this, this.focusRing, this.focused ? leave.art : undefined);
    if (this.focusRing !== undefined) {
      uiObject(this, this.focusRing);
    }
  }

  private controlAt(pointer: Input.Pointer): "leave" | undefined {
    const { art, hit } = this.leaveLayout();
    return pressedArea(
      [{ art, hit, key: "leave" as const }],
      playPoint(this, pointer, this.contentCamera),
    );
  }

  private watchInput(): void {
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      if (this.domReady) {
        return;
      }
      this.pressed = this.controlAt(pointer);
      this.render();
    });
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => {
      if (this.domReady) {
        return;
      }
      const down = this.pressed;
      this.pressed = undefined;
      this.render();
      this.act({ down, kind: "press", up: this.controlAt(pointer) });
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (this.domReady && event.target instanceof Node && this.view?.root.contains(event.target)) {
        return;
      }
      if (!modalInput(this).accepts(event)) {
        return;
      }
      this.act({ key: event.key, kind: "key", repeat: event.repeat, shift: event.shiftKey });
    });
    const onBack = (event: Event) => {
      if (modalInput(this).accepts(event)) {
        this.act({ kind: "back" });
      }
    };
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    this.events.once("shutdown", () => {
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack);
      captureTab(this, false);
    });
  }

  private act(event: RoomEvent): void {
    if (this.leaving) {
      return;
    }
    const outcome = roomEvent(this.focused, event);
    if (outcome.focused !== this.focused) {
      this.focused = outcome.focused;
      this.render();
      if (this.domReady && this.view !== undefined) {
        focusTarget(this.view.leave);
      }
    }
    if (outcome.leaves) {
      this.leave();
    }
  }

  override update(time: number): void {
    if (this.leaving) {
      return;
    }
    const frame = frameSteps(PLAY_STEP_LIMITS, time, this.clock);
    this.clock = frame.clock;
    if (frame.steps > 0) {
      recordRoomTime(this.stage, frame.steps * STEP_SECONDS);
    }
  }

  // Closes the room and resumes the zone, shown again, at the next step.
  private leave(): void {
    this.leaving = true;
    coverZone("room", false);
    this.scene.setVisible(true, ZONE);
    this.scene.resume(ZONE);
    this.scene.stop();
  }

  private colour(name: string): number {
    return paletteColour(this, name);
  }
}
