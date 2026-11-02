import { animationKey, type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import {
  phaserBitmapFont,
  type PhaserFontData,
} from "@andornaut/game-kit/text/phaser/phaserBitmapFont";
import { type Cameras, type GameObjects, type Input, Scene, Scenes } from "phaser";

import { CHARACTERS } from "../data/characters";
import { DIALOGUES, SPEAKERS } from "../data/dialogues";
import { ROOMS } from "../data/rooms";
import { TEXT } from "../data/text";
import type { RoomPlan } from "../data/types";
import { dialogueParagraphs } from "../dialogue/conversation";
import { DIALOGUE_SCREEN, dialogueSpeakerLayout } from "../layout/dialogueScreen";
import { pressedArea } from "../layout/hitAreas";
import { CARD_TEXT_SCALE } from "../layout/pauseCard";
import { ROOM_SCREEN } from "../layout/roomScreen";
import { SKILL_ROOM, skillDetails, skillRoomContinue } from "../layout/skillDetails";
import { type RoomEvent, roomEvent } from "../pause/roomInput";
import { coverZone, PHONE_EVENTS } from "../pwa";
import { grantSkill } from "../save";
import {
  addButtonLabel,
  addCardText,
  addCardTextIn,
  addSlice,
  BODY_FONT,
  BUTTON,
  type ButtonLabel,
  captureTab,
  cardFonts,
  paletteColour,
  placeButtonLabel,
  PRIMARY_BUTTON,
  ringFocus,
  TITLE_FONT,
} from "./cardParts";
import { drawDialogueParagraph } from "./dialogueParagraph";
import { modalInput, onScenePointer } from "./modalInput";
import { fitCanvasCamera, fitPlayCamera, playPoint } from "./playCamera";
import { drawSkillButton } from "./skillButton";

const ZONE = "zone";
// The placeholder frame's line, in base pixels.
const FRAME_LINE = 2;

// What a room opens with: its key in ROOMS.
export interface RoomData {
  readonly room: string;
}

// The room behind a door, over the whole canvas in place of the zone, which ZoneScene pauses
// while it shows: the room's backdrop (or a placeholder ink fill with a frame), its animations
// and cast, its name, and Leave at the top right. Leave, back and Escape each close it and resume
// the zone, which returns her to the door (ZoneScene). Tab and the arrows focus Leave, and Enter
// and Space press it once focused.
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
    this.focused = false;
    this.focusRing = undefined;
    this.leaving = false;
    this.pressed = undefined;
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
    coverZone("room", true);
    captureTab(this, true);

    this.drawRoom();
    this.drawLeave();
    this.render();
    this.watchInput();
    modalInput(this).subscribe(() => {
      this.pressed = undefined;
      this.render();
    });
  }

  private drawRoom(): void {
    if (this.room.grant !== undefined) {
      const words = TEXT.skills[this.room.grant];
      const layout = skillDetails(cardFonts(this), SKILL_ROOM.bounds, false, words);
      addSlice(this, "ui-settings-card", layout.card);
      addCardTextIn(this, TITLE_FONT, layout.title!, words.title, this.colour("ink"));
      addCardTextIn(
        this,
        BODY_FONT,
        layout.groups.description!,
        layout.description,
        this.colour("ink"),
      );
      const icon = drawSkillButton(this, layout.groups.icon!, this.room.grant);
      icon.ready(true);
      const dialogue = this.room.enter === undefined ? undefined : DIALOGUES[this.room.enter];
      if (dialogue === undefined) {
        throw new Error("A skill room needs an entry dialogue");
      }
      {
        const paragraph = dialogueParagraphs(SPEAKERS, TEXT, dialogue)[0]!;
        this.add
          .image(DIALOGUE_SCREEN.box.x, DIALOGUE_SCREEN.box.y, "ui-dialogue-box")
          .setOrigin(0);
        drawDialogueParagraph(this, { ...paragraph, portrait: null });
        if (paragraph.portrait !== null) {
          const at = dialogueSpeakerLayout(paragraph.side).portrait;
          const portraitRoom = 64;
          this.add
            .sprite(at.x + portraitRoom / 2, at.y + portraitRoom / 2, paragraph.portrait)
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
        .lineStyle(FRAME_LINE, this.colour("slate"))
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
    const lineHeight = font.lineHeight * CARD_TEXT_SCALE;
    addCardText(
      this,
      TITLE_FONT,
      {
        x: nameCentre.x - Math.floor(inkWidth(font, CARD_TEXT_SCALE, name) / 2),
        y: nameCentre.y - Math.floor(lineHeight / 2),
      },
      name,
      this.colour("cream"),
    );
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
      leave.art,
      leave.labelY,
      gift ? TEXT.dialogue.continue : TEXT.room.leave,
      {
        colour: this.colour(style.label),
        marked: false,
      },
    );
  }

  // Leave as the press and the focus leave it.
  private render(): void {
    const leave = this.leaveLayout();
    const pressed = this.pressed === "leave";
    this.leaveFaces.normal.setVisible(!pressed);
    this.leaveFaces.pressed.setVisible(pressed);
    placeButtonLabel(this.leaveLabel, pressed ? leave.pressedLabelY : leave.labelY);
    this.focusRing = ringFocus(this, this.focusRing, this.focused ? leave.art : undefined);
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
      this.pressed = this.controlAt(pointer);
      this.render();
    });
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => {
      const down = this.pressed;
      this.pressed = undefined;
      this.render();
      this.act({ down, kind: "press", up: this.controlAt(pointer) });
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
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
    }
    if (outcome.leaves) {
      this.leave();
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
