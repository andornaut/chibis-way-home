// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import markSheet from "../../public/art/sprites/ui-play-mark.json" with { type: "json" };
import { OPENING } from "../data/opening.ts";
import { SCREEN } from "../data/screen.ts";
import { TEXT } from "../data/text.ts";

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
      readonly cache = { json: { get: () => markSheet } };
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
vi.mock("./keyboardCapture.ts", () => ({ captureTab: vi.fn() }));
vi.mock("./scenePalette.ts", () => ({ paletteColour: () => 0 }));
vi.mock("./playCamera.ts", () => ({
  fitPlayCamera: vi.fn(),
  playPoint: (_scene: unknown, pointer: { x: number; y: number }) => pointer,
}));

import { modalInput } from "./modalInput.ts";
import { OpeningScene } from "./OpeningScene.ts";
import { saveOpeningSeen } from "./save.ts";

beforeEach(() => {
  vi.clearAllMocks();
  backgroundFixture.value = undefined;
  dom.enabled = true;
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

it("requires manual fresh activation and saves only at the final beat, not elapsed time or interruption", async () => {
  const { scene } = await htmlOpening();
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
  const { scene: interrupted } = await htmlOpening();
  key(interrupted, "Enter");
  interrupted.events.emit("shutdown");
  expect(saveOpeningSeen).toHaveBeenCalledTimes(1);
});

it("draws palette ink for explicit null backgrounds without any image texture lookup", async () => {
  backgroundFixture.value = null;
  const { scene } = await htmlOpening();
  scene.update(0, 100000);
  key(scene, "Enter");
  expect(scene.add.rectangle).toHaveBeenCalledWith(0, 0, SCREEN.width, SCREEN.height, 0);
  expect(scene.add.image).not.toHaveBeenCalled();
  expect(saveOpeningSeen).not.toHaveBeenCalled();
});
it("retains nonnull texture backgrounds and disposes the previous shot image", async () => {
  backgroundFixture.value = "fixture-background";
  const { scene } = await htmlOpening();
  expect(scene.add.image).toHaveBeenCalledWith(0, 0, "fixture-background");
  const image = vi.mocked(scene.add.image).mock.results[0]!.value;
  key(scene, "Enter");
  expect(image.destroy).toHaveBeenCalledOnce();
  expect(scene.add.image).toHaveBeenCalledTimes(2);
});

async function htmlOpening() {
  dom.enabled = true;
  const scene = opening();
  const root = document.querySelector<HTMLElement>(".opening-scene")!;
  dom.ready!(true);
  await Promise.resolve();
  return { root, scene };
}

it("holds actions until reveal succeeds, then renders each caption in HTML", async () => {
  dom.enabled = true;
  const scene = opening();
  const root = document.querySelector<HTMLElement>(".opening-scene")!;
  const caption = root.querySelector(".opening-caption")!;
  expect(root.hidden).toBe(true);
  expect(root.inert).toBe(true);
  expect(caption.textContent).toBe(TEXT.lines[OPENING[0]!.text]);
  key(scene, "Enter");
  expect(caption.textContent).toBe(TEXT.lines[OPENING[0]!.text]);
  dom.ready!(true);
  await Promise.resolve();
  key(scene, "Enter");
  expect(caption.textContent).toBe(TEXT.lines[OPENING[1]!.text]);
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

it("keeps failed-reveal input disabled and rejects a tap started before readiness", async () => {
  const scene = opening();
  dom.ready!(false);
  await Promise.resolve();
  const root = document.querySelector<HTMLElement>(".opening-scene")!;
  key(scene, "Enter");
  expect(root.hidden).toBe(true);
  expect(root.querySelector(".opening-caption")!.textContent).toBe(TEXT.lines[OPENING[0]!.text]);
  scene.events.emit("shutdown");
  const next = opening();
  const button = document.querySelector<HTMLButtonElement>('[data-control="skip"]')!;
  button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
  dom.ready!(true);
  await Promise.resolve();
  button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  expect(saveOpeningSeen).not.toHaveBeenCalled();
  next.events.emit("shutdown");
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
