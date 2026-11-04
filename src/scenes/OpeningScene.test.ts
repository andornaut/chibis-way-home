import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import { OPENING } from "../data/opening";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { CARD_FONTS } from "../testing/cardFonts";
import { openingLayout } from "../ui";

const backgroundFixture = vi.hoisted(() => ({ value: undefined as string | null | undefined }));
vi.mock("../data/opening", async (original) => {
  const actual = await original<typeof import("../data/opening")>();
  return {
    get OPENING() {
      return backgroundFixture.value === undefined
        ? actual.OPENING
        : actual.OPENING.map((beat) => ({
            ...beat,
            shots: beat.shots.map((shot) => ({ ...shot, background: backgroundFixture.value! })),
          }));
    },
  };
});

vi.mock("phaser", () => {
  const drawable = () => {
    const item: Record<string, unknown> = { frame: { realHeight: 256, realWidth: 256 } };
    for (const name of [
      "destroy",
      "play",
      "setAngle",
      "setFlipX",
      "setOrigin",
      "setPosition",
      "setScale",
      "setText",
      "setTexture",
      "setVisible",
    ]) {
      item[name] = vi.fn(() => item);
    }
    return item;
  };
  return {
    Scene: class {
      readonly add = {
        container: () => ({ add: vi.fn() }),
        image: vi.fn(drawable),
        rectangle: vi.fn(drawable),
        sprite: drawable,
      };
      readonly events = new EventEmitter();
      readonly game = {};
      readonly input = Object.assign(new EventEmitter(), {
        keyboard: new EventEmitter(),
        stopPropagation: vi.fn(),
      });
      readonly scene = { start: vi.fn() };
    },
  };
});
vi.mock("./save", () => ({ saveOpeningSeen: vi.fn() }));
vi.mock("./cardParts", () => ({
  BODY_FONT: "font-body",
  PRIMARY_BUTTON: {},
  addCardText: () => ({ setPosition: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis() }),
  addTextButton: vi.fn(() => ({})),
  captureTab: vi.fn(),
  cardFonts: () => CARD_FONTS,
  paletteColour: () => 0,
  pressTextButton: vi.fn(),
  ringFocus: vi.fn(),
}));
vi.mock("./playCamera", () => ({
  fitPlayCamera: vi.fn(),
  playPoint: (_scene: unknown, pointer: { x: number; y: number }) => pointer,
}));

import { pressTextButton } from "./cardParts";
import { modalInput } from "./modalInput";
import { OpeningScene } from "./OpeningScene";
import { saveOpeningSeen } from "./save";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pressTextButton).mockReset();
  backgroundFixture.value = undefined;
});
function opening() {
  const scene = new OpeningScene();
  scene.create();
  return scene;
}
function key(scene: OpeningScene, key: string, repeat = false) {
  scene.input.keyboard!.emit("keydown", {
    key,
    preventDefault: vi.fn(),
    repeat,
    shiftKey: false,
    stopPropagation: vi.fn(),
  });
}
function pointer(action: "skip" | "continue") {
  const layout = openingLayout(CARD_FONTS, TEXT.dialogue, TEXT.lines[OPENING[0]!.text]!)[action];
  return {
    id: 1,
    wasCanceled: false,
    x: layout.button.x + layout.button.width / 2,
    y: layout.button.y + layout.button.height / 2,
  };
}

it("requires manual fresh activation and saves only at the final beat, not elapsed time or interruption", () => {
  const scene = opening();
  scene.update(0, 100000);
  key(scene, "Enter", true);
  key(scene, "Escape");
  expect(saveOpeningSeen).not.toHaveBeenCalled();
  for (let i = 0; i < OPENING.length - 1; i++) {
    key(scene, "Enter");
  }
  expect(saveOpeningSeen).not.toHaveBeenCalled();
  key(scene, "Enter");
  key(scene, "Enter");
  expect(saveOpeningSeen).toHaveBeenCalledTimes(1);
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("map");
  const interrupted = opening();
  key(interrupted, "Enter");
  interrupted.events.emit("shutdown");
  expect(saveOpeningSeen).toHaveBeenCalledTimes(1);
});

it("rejects inherited releases, drags and modal-crossing gestures before whole-opening Skip", () => {
  const scene = opening();
  const tap = pointer("skip");
  vi.mocked(scene.scene.start).mockImplementation(() => {
    vi.mocked(pressTextButton).mockImplementation(() => {
      throw new Error("Disposed controls");
    });
    return scene.scene;
  });
  scene.input.emit("pointerup", tap);
  scene.input.emit("pointerdown", tap);
  scene.input.emit("pointermove", { ...tap, x: 0 });
  scene.input.emit("pointerup", tap);
  scene.input.emit("pointerdown", tap);
  const cover = { ...scene, events: new EventEmitter() };
  modalInput(cover as unknown as OpeningScene).open();
  modalInput(cover as unknown as OpeningScene).close();
  scene.input.emit("pointerup", tap);
  expect(saveOpeningSeen).not.toHaveBeenCalled();
  scene.input.emit("pointerdown", tap);
  scene.input.emit("pointerup", tap);
  expect(saveOpeningSeen).toHaveBeenCalledTimes(1);
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("map");
});

it("draws palette ink for explicit null backgrounds without any image texture lookup", () => {
  backgroundFixture.value = null;
  const scene = opening();
  scene.update(0, 100000);
  key(scene, "Enter");
  expect(scene.add.rectangle).toHaveBeenCalledWith(0, 0, SCREEN.width, SCREEN.height, 0);
  expect(scene.add.image).not.toHaveBeenCalled();
  expect(saveOpeningSeen).not.toHaveBeenCalled();
});
it("retains nonnull texture backgrounds and disposes the previous shot image", () => {
  backgroundFixture.value = "fixture-background";
  const scene = opening();
  expect(scene.add.image).toHaveBeenCalledWith(0, 0, "fixture-background");
  const image = vi.mocked(scene.add.image).mock.results[0]!.value;
  key(scene, "Enter");
  expect(image.destroy).toHaveBeenCalledOnce();
  expect(scene.add.image).toHaveBeenCalledTimes(2);
});
