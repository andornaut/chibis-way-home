// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import { OPENING } from "../data/opening.ts";
import { SCREEN } from "../data/screen.ts";
import { TEXT } from "../data/text.ts";
import { CARD_FONTS } from "../testing/cardFonts.ts";
import { openingLayout } from "../ui/index.ts";

const dom = vi.hoisted(() => ({
  cancel: vi.fn(),
  enabled: false,
  ready: undefined as ((value: boolean) => void) | undefined,
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: vi.fn(async () => "blob:play-mark"),
  mountSceneView: (scene: OpeningScene, root: HTMLElement) => {
    document.body.append(root);
    scene.events.once("shutdown", () => root.remove());
  },
  revealSceneView: (_scene: unknown, root: HTMLElement) => {
    root.hidden = true;
    root.inert = true;
    return {
      cancel: dom.cancel,
      revealed: new Promise<boolean>((resolve) => {
        dom.ready = (value) => {
          if (value) {
            root.hidden = false;
            root.inert = false;
          }
          resolve(value);
        };
      }),
    };
  },
  sceneDomUi: () => (dom.enabled ? {} : undefined),
}));

const backgroundFixture = vi.hoisted(() => ({ value: undefined as string | null | undefined }));
vi.mock("../data/opening.ts", async (original) => {
  const actual = await original<typeof import("../data/opening.ts")>();
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
vi.mock("./save.ts", () => ({ saveOpeningSeen: vi.fn() }));
vi.mock("./cardParts.ts", () => ({
  BODY_FONT: "font-body",
  PRIMARY_BUTTON: {},
  addCardText: () => ({
    setPosition: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  }),
  addTextButton: vi.fn(() => ({
    faces: { normal: { setVisible: vi.fn() }, pressed: { setVisible: vi.fn() } },
    label: {
      label: { setVisible: vi.fn() },
      mark: { frame: { name: "light" }, setVisible: vi.fn() },
    },
  })),
  captureTab: vi.fn(),
  cardFonts: () => CARD_FONTS,
  paletteColour: () => 0,
  pressTextButton: vi.fn(),
  ringFocus: vi.fn(),
}));
vi.mock("./playCamera.ts", () => ({
  fitPlayCamera: vi.fn(),
  playPoint: (_scene: unknown, pointer: { x: number; y: number }) => pointer,
}));

import { pressTextButton, ringFocus } from "./cardParts.ts";
import { modalInput } from "./modalInput.ts";
import { OpeningScene } from "./OpeningScene.ts";
import { saveOpeningSeen } from "./save.ts";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pressTextButton).mockReset();
  backgroundFixture.value = undefined;
  dom.enabled = false;
  dom.ready = undefined;
  document.body.replaceChildren();
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

it("moves the keyboard's focus through Continue then Skip, wrapping, and presses the focused one", () => {
  const scene = opening();
  const layout = openingLayout(CARD_FONTS, TEXT.dialogue, TEXT.lines[OPENING[0]!.text]!);
  const ringed = () => vi.mocked(ringFocus).mock.lastCall?.[2];
  const steps = ["Tab", "Tab", "Tab"].map((value) => {
    key(scene, value);
    return ringed();
  });
  expect(steps).toEqual([layout.continue.button, layout.skip.button, layout.continue.button]);
  key(scene, "Tab");
  key(scene, "Enter");
  expect(saveOpeningSeen).toHaveBeenCalledOnce();
});

async function htmlOpening() {
  dom.enabled = true;
  const scene = opening();
  const root = document.querySelector<HTMLElement>(".opening-scene")!;
  dom.ready!(true);
  await Promise.resolve();
  return { root, scene };
}

it("keeps the canvas controls until reveal succeeds, then renders each caption in HTML", async () => {
  dom.enabled = true;
  const scene = opening();
  const root = document.querySelector<HTMLElement>(".opening-scene")!;
  const caption = root.querySelector(".opening-caption")!;
  expect(root.hidden).toBe(true);
  expect(root.inert).toBe(true);
  expect(caption.textContent).toBe(TEXT.lines[OPENING[0]!.text]);
  key(scene, "Enter");
  expect(caption.textContent).toBe(TEXT.lines[OPENING[1]!.text]);
  dom.ready!(true);
  await Promise.resolve();
  const before = vi.mocked(pressTextButton).mock.calls.length;
  key(scene, "Enter");
  expect(caption.textContent).toBe(TEXT.lines[OPENING[2]!.text]);
  expect(vi.mocked(pressTextButton).mock.calls.length).toBe(before);
  expect(root.hidden).toBe(false);
});

it("uses HTML Continue then Skip focus order and whole-opening Skip", async () => {
  const { root, scene } = await htmlOpening();
  const next = root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  const skip = root.querySelector<HTMLButtonElement>('[data-control="skip"]')!;
  key(scene, "Tab");
  expect(document.activeElement).toBe(next);
  next.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
  expect(document.activeElement).toBe(skip);
  skip.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  expect(saveOpeningSeen).toHaveBeenCalledOnce();
});

it("rejects HTML inherited releases, outside taps, drags and covered gestures", async () => {
  const { root, scene } = await htmlOpening();
  const skip = root.querySelector<HTMLButtonElement>('[data-control="skip"]')!;
  const pointer = (target: Element, type: string, x = 0) =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, pointerId: 1 }));
  root.style.setProperty("--ui-unit", "1");
  pointer(skip, "pointerup");
  pointer(root, "pointerdown");
  pointer(root, "pointerup");
  pointer(skip, "pointerdown");
  pointer(skip, "pointermove", 100);
  pointer(skip, "pointerup");
  pointer(skip, "pointerdown");
  const cover = { ...scene, events: new EventEmitter() };
  modalInput(cover as unknown as OpeningScene).open();
  modalInput(cover as unknown as OpeningScene).close();
  pointer(skip, "pointerup");
  expect(saveOpeningSeen).not.toHaveBeenCalled();
  pointer(skip, "pointerdown");
  pointer(skip, "pointerup");
  expect(saveOpeningSeen).toHaveBeenCalledOnce();
});

it("cancels a pending reveal at shutdown and cannot hand off to a stale scene", async () => {
  dom.enabled = true;
  const scene = opening();
  const ready = dom.ready!;
  scene.events.emit("shutdown");
  ready(true);
  await Promise.resolve();
  expect(dom.cancel).toHaveBeenCalledOnce();
  expect(document.querySelector(".opening-scene")).toBeNull();
  expect(saveOpeningSeen).not.toHaveBeenCalled();
});

it("retains the canvas controls on reveal failure and cancels a held tap at handoff", async () => {
  dom.enabled = true;
  const scene = opening();
  dom.ready!(false);
  await Promise.resolve();
  const tap = pointer("continue");
  scene.input.emit("pointerdown", tap);
  scene.input.emit("pointerup", tap);
  const root = document.querySelector<HTMLElement>(".opening-scene")!;
  expect(root.hidden).toBe(true);
  expect(root.querySelector(".opening-caption")!.textContent).toBe(TEXT.lines[OPENING[1]!.text]);
  scene.events.emit("shutdown");
  const next = opening();
  const ready = dom.ready!;
  next.input.emit("pointerdown", pointer("skip"));
  ready(true);
  await Promise.resolve();
  next.input.emit("pointerup", pointer("skip"));
  expect(saveOpeningSeen).not.toHaveBeenCalled();
});

it("completes the HTML opening once through fresh Continue without acknowledging intermediate beats", async () => {
  const { root } = await htmlOpening();
  const button = root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  for (const [index, beat] of OPENING.entries()) {
    expect(root.querySelector(".opening-caption")!.textContent).toBe(TEXT.lines[beat.text]);
    button.focus();
    const held = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      repeat: true,
    });
    button.dispatchEvent(held);
    expect(held.defaultPrevented).toBe(true);
    expect(root.querySelector(".opening-caption")!.textContent).toBe(TEXT.lines[beat.text]);
    expect(saveOpeningSeen).not.toHaveBeenCalled();
    button.click();
    expect(saveOpeningSeen).toHaveBeenCalledTimes(index === OPENING.length - 1 ? 1 : 0);
  }
  button.click();
  expect(saveOpeningSeen).toHaveBeenCalledOnce();
});
