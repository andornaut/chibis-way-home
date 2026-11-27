// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import { OPENING } from "../data/opening.ts";
import { SCREEN } from "../data/screen.ts";
import { TEXT } from "../data/text.ts";
import { mountFixtureForeground } from "./foregroundFixture.ts";

const dom = vi.hoisted(() => ({
  cancel: vi.fn(),
  enabled: false,
  ready: undefined as ((value: boolean) => void) | undefined,
}));
vi.mock("./domUi.ts", () => ({
  mountSceneView: (scene: OpeningScene, root: HTMLElement) => {
    document.body.append(root);
    mountFixtureForeground(scene, "opening", root);
    scene.events.once("shutdown", () => root.remove());
  },
  revealSceneView: (_scene: OpeningScene, root: HTMLElement) => {
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
          queueMicrotask(() => _scene.events.emit("postupdate"));
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
function key(_scene: OpeningScene, key: string, repeat = false) {
  if (!dom.enabled) {
    _scene.input.keyboard!.emit("keydown", {
      key,
      preventDefault: vi.fn(),
      repeat,
      shiftKey: false,
      stopPropagation: vi.fn(),
    });
    return;
  }
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, repeat }),
  );
  if (!repeat) {
    target.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key }));
  }
}

it("requires manual fresh activation and saves only at the final beat, not elapsed time or interruption", async () => {
  const { scene } = await htmlOpening();
  scene.update(0, 100000);
  key(scene, "Enter", true);
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

it("skips hidden Previous in the initial focus order and still skips the whole opening", async () => {
  const { root } = await htmlOpening();
  const next = root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  const skip = root.querySelector<HTMLButtonElement>('[data-control="skip"]')!;
  expect(document.activeElement).toBe(next);
  next.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
  expect(document.activeElement).toBe(skip);
  skip.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  expect(saveOpeningSeen).toHaveBeenCalledOnce();
});

it("moves focus from final-page Skip to Next and rejects the unavailable action", async () => {
  const { root, scene } = await htmlOpening();
  const controls = scene as unknown as { activate(action: "continue" | "skip"): void };
  for (let index = 0; index < OPENING.length - 2; index++) {
    controls.activate("continue");
  }
  const skip = root.querySelector<HTMLButtonElement>('[data-control="skip"]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  expect(skip.hidden).toBe(false);
  skip.focus();
  controls.activate("continue");
  expect(skip.hidden).toBe(true);
  expect(document.activeElement).toBe(next);
  controls.activate("skip");
  expect(saveOpeningSeen).not.toHaveBeenCalled();
  controls.activate("continue");
  expect(saveOpeningSeen).toHaveBeenCalledOnce();
});

it("returns to the first caption without saving and moves focus from hidden Previous to Next", async () => {
  const { root, scene } = await htmlOpening();
  const caption = root.querySelector(".opening-caption")!;
  const previous = root.querySelector<HTMLButtonElement>('[data-control="previous"]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  expect(previous.hidden).toBe(true);
  previous.click();
  expect(caption.textContent).toBe(TEXT.lines[OPENING[0]!.text]);

  key(scene, "Enter");
  expect(caption.textContent).toBe(TEXT.lines[OPENING[1]!.text]);
  expect(previous.hidden).toBe(false);
  next.focus();
  next.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
  expect(document.activeElement).toBe(previous);
  previous.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  expect(caption.textContent).toBe(TEXT.lines[OPENING[0]!.text]);
  expect(previous.hidden).toBe(true);
  expect(document.activeElement).toBe(next);
  expect(saveOpeningSeen).not.toHaveBeenCalled();
  expect(scene.scene.start).not.toHaveBeenCalled();
});

it("rejects HTML inherited releases, outside taps, drags and covered gestures", async () => {
  const { root, scene } = await htmlOpening();
  const skip = root.querySelector<HTMLButtonElement>('[data-control="skip"]')!;
  const pointer = (target: Element, type: string, x = 0) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        clientX: x,
        isPrimary: true,
        pointerId: 1,
      }),
    );
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
  button.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true, pointerId: 1 }),
  );
  dom.ready!(true);
  await Promise.resolve();
  button.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, button: 0, isPrimary: true, pointerId: 1 }),
  );
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

it("uses one eligible Escape Skip without treating its repeat as a new action", async () => {
  const { scene } = await htmlOpening();
  key(scene, "Escape");
  key(scene, "Escape", true);
  expect(saveOpeningSeen).toHaveBeenCalledOnce();
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("map");
});
