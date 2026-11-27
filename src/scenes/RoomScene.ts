import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
} from "@andornaut/game-kit/runtime/art/aseprite";
import {
  frameSteps,
  startStepClock,
  type StepClock,
} from "@andornaut/game-kit/runtime/clock/fixedStep";
import { fillNames } from "@andornaut/game-kit/runtime/lines";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { writeLayoutProperties } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";
import { type Cameras, type GameObjects, Scene, Scenes } from "phaser";

import { PLAY_STEP_LIMITS, STEP_SECONDS } from "../core/index.ts";
import { CHARACTERS } from "../data/characters.ts";
import { DIALOGUES, GIFT_CONVERSATIONS, SPEAKERS } from "../data/dialogues.ts";
import { ROOM_LAYOUT } from "../data/layout.ts";
import { ZONE_MAP } from "../data/map.ts";
import { ROOMS } from "../data/rooms.ts";
import { TEXT } from "../data/text.ts";
import type { RoomPlan } from "../data/types/index.ts";
import { PHONE_EVENTS } from "../pwa/index.ts";
import {
  createRoomView,
  DIALOGUE_PORTRAIT_SIZE,
  dialogueParagraphs,
  dialogueSpeakerLayout,
  focusKeyAction,
  ROOM_SCREEN,
  type RoomEvent,
  roomEvent,
  roomPortraitProperties,
  type RoomView,
  SKILL_ART,
  stepFocus,
} from "../ui/index.ts";
import type { DialogueData, DialogueOpener } from "./DialogueScene.ts";
import { bindSceneActions } from "./domTaps.ts";
import { artFrameUrl, mountSceneView, revealSceneView, sceneDomUi } from "./domUi.ts";
import { captureTab } from "./keyboardCapture.ts";
import { modalInput } from "./modalInput.ts";
import { fitCanvasCamera, fitPlayCamera } from "./playCamera.ts";
import { grantSkill, recordRoomTime } from "./save.ts";
import { paletteColour } from "./scenePalette.ts";

const ZONE = "zone";
type RoomControl = "leave" | "talk";
type RoomActionEvent =
  | Exclude<RoomEvent, { readonly kind: "press" }>
  | {
      readonly down: RoomControl | undefined;
      readonly kind: "press";
      readonly up: RoomControl | undefined;
    };

// What a room opens with: its key in ROOMS, and the stage whose door leads to it.
export interface RoomData {
  readonly room: string;
  readonly stage: string;
  readonly zoneScopedGift?: boolean;
}

// The room behind a door, over the whole canvas in place of the zone, which ZoneScene pauses
// while it shows: the room's backdrop (or a placeholder ink fill with a frame), its animations
// and cast, its name, and Leave at the top right. Leave, back and Escape each close it and resume
// the zone, which returns him to the door (ZoneScene). Tab and arrows focus room actions; Enter
// and Space press the focused action. Time in the room is active play: it counts toward the stage's
// attempt and totals on the zone's step clock, and time while the room is paused does not.
export class RoomScene extends Scene implements DialogueOpener {
  private contentCamera!: Cameras.Scene2D.Camera;
  private focused: RoomControl | undefined;
  private conversation: string | undefined;
  private talking = false;
  private zoneScopedGift = false;
  private leaving = false;
  private pressed: RoomControl | undefined;
  private room!: RoomPlan;
  private roomKey = "";
  private stage = "";
  private clock: StepClock = startStepClock;
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
    this.focused = undefined;
    this.talking = false;
    this.zoneScopedGift = data.zoneScopedGift === true;
    const destination = ZONE_MAP.destinations.find(({ stages }) => stages.includes(data.stage));
    this.conversation =
      room.conversation === "mallow-gift" && destination !== undefined
        ? GIFT_CONVERSATIONS[destination.id]
        : room.conversation;
    this.leaving = false;
    this.pressed = undefined;
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
    captureTab(this, true);

    modalInput(this).ready(false);
    this.drawRoom();
    this.watchInput();
    modalInput(this).subscribe(() => {
      this.pressed = undefined;
      this.render();
    });
    this.createDomView();
  }

  private drawRoom(): void {
    if (this.room.grant !== undefined) {
      const dialogue = this.room.enter === undefined ? undefined : DIALOGUES[this.room.enter];
      if (dialogue === undefined) {
        throw new Error("A skill room needs an entry dialogue");
      }
      {
        const paragraph = dialogueParagraphs(SPEAKERS, TEXT, dialogue)[0]!;
        if (paragraph.portrait !== null) {
          const at = dialogueSpeakerLayout(paragraph.side).portrait;
          this.portrait = this.add
            .sprite(
              at.x + DIALOGUE_PORTRAIT_SIZE / 2,
              at.y + DIALOGUE_PORTRAIT_SIZE / 2,
              paragraph.portrait,
            )
            .play(animationKey(paragraph.portrait, "idle"))
            .setVisible(false);
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
      {
        action: words === undefined ? TEXT.room.leave : TEXT.room.continue,
        actions: TEXT.buttons,
        icons: TEXT.actionIcons,
        name: TEXT.rooms[this.roomKey]?.name ?? "",
        ...(this.conversation === undefined ? {} : { talk: TEXT.room.talk }),
        ...(words === undefined || paragraph === undefined
          ? {}
          : {
              gift: {
                description: words.description,
                disc: fillNames(TEXT.skillDetails.disc, { skill: words.title }),
                paragraph,
                title: words.title,
                ...(this.zoneScopedGift ? { lifetime: TEXT.room.giftLifetime } : {}),
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
      this.talking = false;
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
        modalInput(this).ready(true);
        this.renderDomPortrait();
        this.restoreFocus();
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
    view.root.addEventListener("keydown", onKey);
    const stopTaps = bindSceneActions<RoomControl>(
      { preventDefault: true, target: view.root, view: view.root },
      input,
      {
        accepts: () => this.domReady && !this.leaving && !this.talking,
        activate: (control) => this.act({ down: control, kind: "press", up: control }),
        controlAt: (event) =>
          view.talk !== undefined && event.composedPath().includes(view.talk)
            ? "talk"
            : event.composedPath().includes(view.leave)
              ? "leave"
              : null,
        controls: view.talk === undefined ? ["leave"] : ["talk", "leave"],
        element: (control) => (control === "talk" ? view.talk! : view.leave),
        show: (pressed) => {
          this.pressed = pressed;
          this.render();
        },
      },
    );
    return () => {
      stopTaps();
      view.root.removeEventListener("keydown", onKey);
    };
  }

  private render(): void {
    this.view?.leave.toggleAttribute("data-pressed", this.pressed === "leave");
    this.view?.talk?.toggleAttribute("data-pressed", this.pressed === "talk");
  }

  private watchInput(): void {
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

  private act(event: RoomActionEvent): void {
    if (this.leaving || this.talking) {
      return;
    }
    if (event.kind === "press") {
      if (event.down !== undefined && event.down === event.up) {
        if (event.down === "talk") {
          this.talk();
        } else {
          this.leave();
        }
      }
      return;
    }
    const action =
      event.kind === "key" ? focusKeyAction(event.key, event.shift, event.repeat) : undefined;
    if (this.view?.talk !== undefined && (action === "next" || action === "previous")) {
      this.focused = stepFocus(["talk", "leave"] as const, this.focused, action);
      this.restoreFocus();
      return;
    }
    if (action === "press" && this.focused === "talk") {
      this.talk();
      return;
    }
    const outcome = roomEvent(this.focused === "leave", event);
    if (outcome.focused && this.focused !== "leave") {
      this.focused = "leave";
      this.render();
      this.restoreFocus();
    }
    if (outcome.leaves) {
      this.leave();
    }
  }

  private restoreFocus(): void {
    if (!this.domReady || this.view === undefined || this.focused === undefined) {
      return;
    }
    const target = this.focused === "talk" ? this.view.talk : this.view.leave;
    if (target !== undefined) {
      focusTarget(target);
    }
  }

  private talk(): void {
    if (this.conversation === undefined) {
      return;
    }
    this.talking = true;
    this.focused = "talk";
    this.pressed = undefined;
    modalInput(this).ready(false);
    this.render();
    this.scene.launch("dialogue", {
      linear: true,
      opener: "room",
      scene: this.conversation,
    } satisfies DialogueData);
    this.scene.pause();
  }

  dialogueClosed(): void {
    if (!this.talking || this.leaving) {
      return;
    }
    this.talking = false;
    this.pressed = undefined;
    this.clock = startStepClock;
    this.scene.resume();
    modalInput(this).ready(this.domReady);
    this.restoreFocus();
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
    this.scene.setVisible(true, ZONE);
    this.scene.resume(ZONE);
    this.scene.stop();
  }

  private colour(name: string): number {
    return paletteColour(this, name);
  }
}
