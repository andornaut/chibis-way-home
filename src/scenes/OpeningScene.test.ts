import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import { OPENING } from "../data/opening";
import { TEXT } from "../data/text";
import { openingLayout } from "../layout/opening";
import { CARD_FONTS } from "../testing/cardFonts";

vi.mock("phaser", () => {
  const drawable = () => {
    const item: Record<string, unknown> = { frame: { realHeight: 256, realWidth: 256 } };
    for (const name of [
      "destroy",
      "play",
      "setAngle",
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
        image: drawable,
        rectangle: drawable,
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
vi.mock("../save", () => ({ saveOpeningSeen: vi.fn() }));
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

import { saveOpeningSeen } from "../save";
import { pressTextButton } from "./cardParts";
import { modalInput } from "./modalInput";
import { OpeningScene } from "./OpeningScene";

beforeEach(() => vi.clearAllMocks());
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
  const layout = openingLayout(CARD_FONTS.body, TEXT.dialogue, TEXT.lines[OPENING[0]!.text]!)[
    action
  ];
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
